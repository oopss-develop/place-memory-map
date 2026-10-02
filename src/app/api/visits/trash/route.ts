import { NextResponse } from "next/server";
import { z } from "zod";
import { getAccessWorkspaceUser } from "@/lib/access-workspace";
export async function GET(request: Request) {
  const auth = await getAccessWorkspaceUser();
  if (!auth) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const group = z.string().uuid().safeParse(new URL(request.url).searchParams.get("groupId"));
  if (!group.success) return NextResponse.json({ error: "지도를 선택해 주세요." }, { status: 400 });
  const { data: membership } = await auth.supabase.from("group_members").select("user_id").eq("group_id",group.data).eq("user_id",auth.userId).maybeSingle();
  if (!membership) return NextResponse.json({ error: "이 지도의 휴지통에 접근할 권한이 없습니다." },{status:403});
  const { data, error } = await auth.supabase.from("visits").select("id,title,version,deleted_at,places(name)").eq("group_id", group.data).not("deleted_at", "is", null).gt("deleted_at", new Date(Date.now() - 30 * 86400000).toISOString()).is("purge_started_at", null).order("deleted_at", { ascending: false });
  if (error) return NextResponse.json({ error: "휴지통을 불러오지 못했습니다." }, { status: 500 });
  return NextResponse.json({ visits: data });
}
