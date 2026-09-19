import { NextResponse } from "next/server";
import { getAllowedMember, getAllowedMembers, safeNextPath } from "@/lib/access-auth";
import { magicLinkSchema } from "@/lib/schemas";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = magicLinkSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "로그인 서비스가 아직 연결되지 않았습니다." }, { status: 503 });
  if (getAllowedMembers().length !== 4) return NextResponse.json({ error: "허용된 사용자 네 명을 먼저 등록해 주세요." }, { status: 503 });

  const member = getAllowedMember(parsed.data.email);
  if (!member) return NextResponse.json({ error: "등록된 네 명의 이메일만 사용할 수 있어요." }, { status: 403 });

  const url = new URL(request.url);
  const appOrigin = process.env.NEXT_PUBLIC_APP_URL ? new URL(process.env.NEXT_PUBLIC_APP_URL).origin : url.origin;
  const callback = new URL("/auth/callback", appOrigin);
  callback.searchParams.set("next", safeNextPath(typeof body?.next === "string" ? body.next : "/"));

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: member.email,
    options: {
      emailRedirectTo: callback.toString(),
      shouldCreateUser: true,
      data: { display_name: member.displayName },
    },
  });
  if (error) {
    const status = error.status === 429 ? 429 : 502;
    return NextResponse.json({ error: status === 429 ? "로그인 메일 요청이 많아요. 잠시 후 다시 시도해 주세요." : "로그인 메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status });
  }
  return NextResponse.json({ ok: true });
}
