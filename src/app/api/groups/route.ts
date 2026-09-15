import { NextResponse } from "next/server";
import { z } from "zod";
import { getAccessWorkspaceUser } from "@/lib/access-workspace";

const schema = z.object({ name: z.string().trim().min(2, "지도 이름을 두 글자 이상 입력해 주세요.").max(60) });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  const workspace = await getAccessWorkspaceUser();
  if (!workspace) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { data: group, error: groupError } = await workspace.supabase
    .from("groups")
    .insert({ name: parsed.data.name, created_by: workspace.userId })
    .select("id,name,created_by")
    .single();
  if (groupError) return NextResponse.json({ error: "지도를 만들지 못했습니다." }, { status: 400 });

  const { error: memberError } = await workspace.supabase.from("group_members").insert(
    workspace.identities.map((identity) => ({ group_id: group.id, user_id: identity.userId, role: identity.userId === workspace.userId ? "owner" : "member" })),
  );
  if (memberError) {
    await workspace.supabase.from("groups").delete().eq("id", group.id);
    return NextResponse.json({ error: "지도 구성원을 추가하지 못했습니다." }, { status: 400 });
  }

  return NextResponse.json({ group: { id: group.id, name: group.name, role: "owner", memberCount: workspace.identities.length, ownerId: group.created_by } }, { status: 201 });
}
