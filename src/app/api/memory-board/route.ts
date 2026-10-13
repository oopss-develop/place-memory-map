import { NextResponse } from "next/server";
import { z } from "zod";
import { getAccessWorkspaceUser } from "@/lib/access-workspace";
import { emptyBoard, saveBoardSchema } from "@/lib/memory-board";

function boardError(error: unknown) {
  const issue = error as { code?: string; message?: string };
  const missing = ["42P01", "PGRST202", "PGRST205"].includes(issue.code ?? "");
  return NextResponse.json({ error: missing ? "추억 보드 DB 업데이트가 필요합니다. 202610130001_memory_boards.sql을 적용해 주세요." :
    issue.code === "40001" ? "다른 멤버가 먼저 보드를 수정했습니다. 내 배치는 유지했어요. 최신 보드를 확인해 주세요." : issue.message ?? "보드를 저장하지 못했습니다." },
    { status: missing ? 503 : issue.code === "40001" ? 409 : issue.code === "42501" ? 403 : 400 });
}
export async function GET(request: Request) {
  const auth = await getAccessWorkspaceUser();
  if (!auth) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const parsed = z.string().uuid().safeParse(new URL(request.url).searchParams.get("groupId"));
  if (!parsed.success) return NextResponse.json({ error: "지도를 선택해 주세요." }, { status: 400 });
  try {
    const member = await auth.supabase.from("group_members").select("group_id").eq("group_id", parsed.data).eq("user_id", auth.userId).maybeSingle();
    if (member.error) throw member.error;
    if (!member.data) return NextResponse.json({ error: "이 지도의 접근 권한이 없습니다." }, { status: 403 });
    const { data, error } = await auth.supabase.from("memory_boards").select("background,items,version").eq("group_id", parsed.data).maybeSingle();
    if (error) throw error;
    return NextResponse.json({ board: data ?? emptyBoard() });
  } catch (error) { return boardError(error); }
}
export async function PUT(request: Request) {
  const auth = await getAccessWorkspaceUser();
  if (!auth) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  try {
    const parsed = saveBoardSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    const { data, error } = await auth.supabase.rpc("save_memory_board", { payload: parsed.data });
    if (error) throw error;
    return NextResponse.json({ board: { background: data.background, items: data.items, version: data.version } });
  } catch (error) { return boardError(error); }
}
