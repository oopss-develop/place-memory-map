import { NextResponse } from "next/server";
import { z } from "zod";
import { getAccessWorkspaceUser } from "@/lib/access-workspace";

const schema = z.object({ name: z.string().trim().min(2, "지도 이름을 두 글자 이상 입력해 주세요.").max(60) });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  const workspace = await getAccessWorkspaceUser();
  if (!workspace) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { data: groupId, error: createError } = await workspace.supabase.rpc("create_group", { group_name: parsed.data.name });
  if (createError || !groupId) return NextResponse.json({ error: "지도를 만들지 못했습니다." }, { status: 400 });
  const { data: group, error: groupError } = await workspace.supabase.from("groups").select("id,name,created_by").eq("id", groupId).single();
  if (groupError || !group) return NextResponse.json({ error: "만든 지도를 불러오지 못했습니다." }, { status: 500 });

  return NextResponse.json({ group: { id: group.id, name: group.name, role: "owner", memberCount: 1, ownerId: group.created_by } }, { status: 201 });
}
