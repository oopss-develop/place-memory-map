import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const groupIdSchema = z.string().uuid();

export async function DELETE(_: Request, context: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await context.params;
  if (!groupIdSchema.safeParse(groupId).success) return NextResponse.json({ error: "그룹 정보가 올바르지 않습니다." }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const [{ data: membership, error: membershipError }, { data: memberships, error: membershipsError }] = await Promise.all([
    supabase.from("group_members").select("role").eq("group_id", groupId).eq("user_id", auth.user.id).maybeSingle(),
    supabase.from("group_members").select("group_id").eq("user_id", auth.user.id),
  ]);
  if (membershipError || membershipsError) return NextResponse.json({ error: "그룹 권한을 확인하지 못했습니다." }, { status: 500 });
  if (membership?.role !== "owner") return NextResponse.json({ error: "이 지도는 만든 사람만 삭제할 수 있어요." }, { status: 403 });
  if ((memberships?.length ?? 0) <= 1) return NextResponse.json({ error: "마지막 지도는 삭제할 수 없어요." }, { status: 409 });

  const { error } = await supabase.from("groups").delete().eq("id", groupId);
  if (error) return NextResponse.json({ error: "지도를 삭제하지 못했습니다." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
