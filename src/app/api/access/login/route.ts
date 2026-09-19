import { NextResponse } from "next/server";
import { getAllowedMemberCredential, getAllowedMembers } from "@/lib/access-auth";
import { magicLinkSchema } from "@/lib/schemas";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createHash } from "node:crypto";

function getInternalPassword(email: string, keyword: string, serviceRoleKey: string) {
  return createHash("sha256").update(`${email.toLowerCase()}:${keyword}:${serviceRoleKey}`).digest("hex");
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = magicLinkSchema.extend({ keyword: z.string().trim().min(1) }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "로그인 서비스가 아직 연결되지 않았습니다." }, { status: 503 });
  if (getAllowedMembers().length !== 4) return NextResponse.json({ error: "허용된 사용자 네 명을 먼저 등록해 주세요." }, { status: 503 });

  const member = getAllowedMemberCredential(parsed.data.email, parsed.data.keyword);
  if (!member) return NextResponse.json({ error: "이메일과 키워드가 일치하지 않습니다." }, { status: 403 });

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다." }, { status: 503 });
  const internalPassword = getInternalPassword(member.email, parsed.data.keyword, serviceRoleKey);

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: users, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) return NextResponse.json({ error: "사용자 계정을 확인하지 못했습니다." }, { status: 502 });
  let userId = users.users.find((user) => user.email?.toLowerCase() === member.email.toLowerCase())?.id;

  if (userId) {
    const { error } = await admin.auth.admin.updateUserById(userId, { password: internalPassword, email_confirm: true, user_metadata: { display_name: member.displayName } });
    if (error) return NextResponse.json({ error: "사용자 계정을 준비하지 못했습니다." }, { status: 502 });
  } else {
    const { data, error } = await admin.auth.admin.createUser({ email: member.email, password: internalPassword, email_confirm: true, user_metadata: { display_name: member.displayName } });
    if (error || !data.user) return NextResponse.json({ error: "사용자 계정을 만들지 못했습니다." }, { status: 502 });
    userId = data.user.id;
  }

  const { error: profileError } = await admin
    .from("profiles")
    .upsert({ id: userId, display_name: member.displayName }, { onConflict: "id" });
  if (profileError) return NextResponse.json({ error: "사용자 이름을 저장하지 못했습니다." }, { status: 502 });

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: member.email,
    password: internalPassword,
  });
  if (error) return NextResponse.json({ error: "로그인하지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 502 });
  return NextResponse.json({ ok: true, userId });
}
