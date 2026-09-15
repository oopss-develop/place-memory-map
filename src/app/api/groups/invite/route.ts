import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({ groupId: z.string().uuid() });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "그룹 정보가 올바르지 않습니다." }, { status: 400 });
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const token = randomBytes(24).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const { error } = await supabase.from("group_invites").insert({ group_id: parsed.data.groupId, token_hash: tokenHash, created_by: data.user.id, expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() });
  if (error) return NextResponse.json({ error: "초대 링크를 만들 권한이 없습니다." }, { status: 403 });
  return NextResponse.json({ url: `${new URL(request.url).origin}/invite/${token}` });
}
