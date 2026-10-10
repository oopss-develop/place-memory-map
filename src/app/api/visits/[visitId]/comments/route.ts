import { NextResponse } from "next/server";
import { z } from "zod";
import { getAccessWorkspaceUser } from "@/lib/access-workspace";

import { resolveSticker } from "@/lib/stickers";

type Context = { params: Promise<{ visitId: string }> };
const uuid = z.string().uuid();
const createSchema = z.object({ id: uuid, body: z.string().trim().max(1000).default(""), stickerId: z.string().max(512).nullable().optional() }).refine(value => Boolean(value.body || value.stickerId));
type DbError = { code?: string; message?: string };
const missingSchema = (error: DbError) => ["42P01", "42703", "PGRST200", "PGRST202", "PGRST204", "PGRST205"].includes(error.code ?? "");
const missingStickerColumn = (error: DbError) => ["42703", "PGRST204"].includes(error.code ?? "") && /sticker_id/i.test(error.message ?? "");
const schemaMessage = "댓글 DB 업데이트가 필요합니다. Supabase SQL Editor에서 202610100001_visit_comments.sql과 202610100002_comment_stickers.sql 중 아직 적용하지 않은 파일을 순서대로 실행해 주세요.";
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
    let stickersAvailable = true;
    for (let offset = 0; ; offset += 250) {
      const fetchPage = (withStickers: boolean) => auth.supabase.from("visit_comments").select(withStickers ? "id,body,sticker_id,author_id,created_at,profiles(display_name)" : "id,body,author_id,created_at,profiles(display_name)").eq("visit_id", visitId).order("created_at").order("id").range(offset, offset + 249);
      let result = await fetchPage(stickersAvailable);
      if (result.error && stickersAvailable && missingStickerColumn(result.error)) {
        stickersAvailable = false;
        result = await fetchPage(false);
      }
      const { data, error } = result;
      if (error) throw error;
      type CommentRow = { id: string; body: string; sticker_id?: string | null; author_id: string; created_at: string; profiles: { display_name: string } | { display_name: string }[] | null };
      for (const row of (data ?? []) as unknown as CommentRow[]) {
        const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
        comments.push({ id: row.id, body: row.body, stickerId: row.sticker_id ?? null, sticker: resolveSticker(row.sticker_id), authorName: profile?.display_name ?? "멤버", createdAt: row.created_at, own: row.author_id === auth.userId });
      }
      if (!data || data.length < 250) break;
    }
    return NextResponse.json({ comments, stickersAvailable, ...(!stickersAvailable ? { warning: "텍스트 댓글은 사용할 수 있어요. 이모티콘 댓글을 사용하려면 Supabase SQL Editor에서 202610100002_comment_stickers.sql을 적용해 주세요." } : {}) }, { headers });
  } catch (reason) {
    const error = reason as DbError;
    console.error("[visit-comments] GET failed", { code: error.code ?? "UNKNOWN" });
    return NextResponse.json({ error: missingSchema(error) ? schemaMessage : "댓글을 불러오지 못했습니다. 다시 시도해 주세요.", ...(missingSchema(error) ? { code: "COMMENT_SCHEMA_MISSING" } : {}) }, { status: 503, headers });
  }
}

async function write(request: Request, { params }: Context, deleting: boolean) {
  const auth = await getAccessWorkspaceUser();
  if (!auth) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const { visitId } = await params;
  if (!uuid.safeParse(visitId).success) return NextResponse.json({ error: "기록을 확인해 주세요." }, { status: 400 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "댓글 내용을 확인해 주세요." }, { status: 400 }); }
  const parsed = (deleting ? z.object({ id: uuid }) : createSchema).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "텍스트(최대 1000자) 또는 이모티콘을 선택해 주세요." }, { status: 400 });
  try {
    const comment = deleting ? null : createSchema.parse(body);
    if (comment?.stickerId && !resolveSticker(comment.stickerId)) return NextResponse.json({ error: "사용할 수 없는 이모티콘입니다. 다시 선택해 주세요." }, { status: 400, headers });
    const args = { target_visit: visitId, comment_id: parsed.data.id };
    const { error } = deleting
      ? await auth.supabase.rpc("delete_visit_comment", args)
      : await auth.supabase.rpc("add_visit_comment", { ...args, comment_body: comment!.body, ...(comment?.stickerId ? { comment_sticker_id: comment.stickerId } : {}) });
    if (error) {
      if (missingSchema(error)) return NextResponse.json({ error: schemaMessage, code: "COMMENT_SCHEMA_MISSING" }, { status: 503, headers });
      const status = error.code === "42501" ? 403 : error.code === "40001" ? 409 : error.code === "22023" ? 400 : 503;
      return NextResponse.json({ error: status === 403 ? "기록 접근 권한이 없거나 본인 댓글이 아닙니다." : status === 409 ? "이미 전송된 댓글입니다. 새로고침 후 확인해 주세요." : "댓글을 저장하지 못했습니다. 다시 시도해 주세요." }, { status, headers });
    }
    return NextResponse.json({ ok: true }, { headers });
  } catch { return NextResponse.json({ error: "댓글을 저장하지 못했습니다. 다시 시도해 주세요." }, { status: 503, headers }); }
}
export const POST = (request: Request, context: Context) => write(request, context, false);
export const DELETE = (request: Request, context: Context) => write(request, context, true);
