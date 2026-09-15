import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAccessWorkspaceUser } from "@/lib/access-workspace";

const schema = z.object({ groupId: z.string().uuid() });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "그룹 정보가 올바르지 않습니다." }, { status: 400 });
  const workspace = await getAccessWorkspaceUser();
  if (!workspace) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const token = randomBytes(24).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const { data: membership } = await workspace.supabase.from("group_members").select("role").eq("group_id", parsed.data.groupId).eq("user_id", workspace.userId).maybeSingle();
  if (membership?.role !== "owner") return NextResponse.json({ error: "초대 링크는 만든 사람만 만들 수 있습니다." }, { status: 403 });
  const { error } = await workspace.supabase.from("group_invites").insert({ group_id: parsed.data.groupId, token_hash: tokenHash, created_by: workspace.userId, expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() });
  if (error) return NextResponse.json({ error: "초대 링크를 만들 권한이 없습니다." }, { status: 403 });
  return NextResponse.json({ url: `${new URL(request.url).origin}/invite/${token}` });
}
