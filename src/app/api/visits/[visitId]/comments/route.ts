import { NextResponse } from "next/server";
import { z } from "zod";
import { getAccessWorkspaceUser } from "@/lib/access-workspace";

type Context = { params: Promise<{ visitId: string }> };
const uuid = z.string().uuid();
const createSchema = z.object({ id: uuid, body: z.string().trim().min(1).max(1000) });
const headers = { "Cache-Control": "private, no-store" };

export async function GET(_request: Request, { params }: Context) {
  const auth = await getAccessWorkspaceUser();
  if (!auth) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const { visitId } = await params;
  if (!uuid.safeParse(visitId).success) return NextResponse.json({ error: "기록을 확인해 주세요." }, { status: 400 });
  try {
    const { data: visit, error: visitError } = await auth.supabase.from("visits").select("id").eq("id", visitId).is("deleted_at", null).maybeSingle();
    if (visitError) throw visitError;
    if (!visit) return NextResponse.json({ error: "기록이 삭제되었거나 접근 권한이 없습니다." }, { status: 404 });
    const comments = [];
    for (let offset = 0; ; offset += 250) {
      const { data, error } = await auth.supabase.from("visit_comments").select("id,body,author_id,created_at,profiles(display_name)").eq("visit_id", visitId).order("created_at").order("id").range(offset, offset + 249);
      if (error) throw error;
      for (const row of data ?? []) {
        const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
        comments.push({ id: row.id, body: row.body, authorName: profile?.display_name ?? "멤버", createdAt: row.created_at, own: row.author_id === auth.userId });
      }
      if (!data || data.length < 250) break;
    }
    return NextResponse.json({ comments }, { headers });
  } catch { return NextResponse.json({ error: "댓글을 불러오지 못했습니다. 다시 시도해 주세요." }, { status: 503, headers }); }
}

async function write(request: Request, { params }: Context, deleting: boolean) {
  const auth = await getAccessWorkspaceUser();
  if (!auth) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const { visitId } = await params;
  if (!uuid.safeParse(visitId).success) return NextResponse.json({ error: "기록을 확인해 주세요." }, { status: 400 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "댓글 내용을 확인해 주세요." }, { status: 400 }); }
  const parsed = (deleting ? z.object({ id: uuid }) : createSchema).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "댓글은 1~1000자로 입력해 주세요." }, { status: 400 });
  try {
    const args = { target_visit: visitId, comment_id: parsed.data.id };
    const { error } = deleting
      ? await auth.supabase.rpc("delete_visit_comment", args)
      : await auth.supabase.rpc("add_visit_comment", { ...args, comment_body: createSchema.parse(body).body });
    if (error) {
      const status = error.code === "42501" ? 403 : error.code === "40001" ? 409 : error.code === "22023" ? 400 : 503;
      return NextResponse.json({ error: status === 403 ? "기록 접근 권한이 없거나 본인 댓글이 아닙니다." : status === 409 ? "이미 전송된 댓글입니다. 새로고침 후 확인해 주세요." : "댓글을 저장하지 못했습니다. 다시 시도해 주세요." }, { status, headers });
    }
    return NextResponse.json({ ok: true }, { headers });
  } catch { return NextResponse.json({ error: "댓글을 저장하지 못했습니다. 다시 시도해 주세요." }, { status: 503, headers }); }
}
export const POST = (request: Request, context: Context) => write(request, context, false);
export const DELETE = (request: Request, context: Context) => write(request, context, true);
