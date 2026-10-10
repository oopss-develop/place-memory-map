import { z } from "zod";
import { getAccessWorkspaceUser } from "@/lib/access-workspace";
import { resolveSticker } from "@/lib/stickers";
const headers = { "Cache-Control": "private, no-store" };
export async function GET() {
  try {
    const auth = await getAccessWorkspaceUser();
    if (!auth) return Response.json({ error: "로그인이 필요합니다." }, { status: 401, headers });
    const [list, count] = await Promise.all([
      auth.supabase.rpc("list_comment_notifications"),
      auth.supabase.from("comment_notifications").select("comment_id", { count: "exact", head: true }).eq("user_id", auth.userId).is("read_at", null),
    ]);
    if (list.error || count.error) throw list.error ?? count.error;
    return Response.json({ notifications: (list.data ?? []).map((row: { comment_id: string; visit_id: string; group_id: string; body: string; sticker_id: string | null; author_name: string; place_name: string; created_at: string; read_at: string | null; own: boolean }) => ({
      commentId: row.comment_id, visitId: row.visit_id, groupId: row.group_id, body: row.body, stickerName: resolveSticker(row.sticker_id)?.name ?? (row.sticker_id ? "이모티콘" : null), authorName: row.author_name, placeName: row.place_name, createdAt: row.created_at, readAt: row.read_at, own: row.own,
    })), unreadCount: count.count ?? 0 }, { headers });
  } catch { return Response.json({ error: "댓글 알림을 불러오지 못했어요. 다시 시도해 주세요." }, { status: 503, headers }); }
}
export async function POST(request: Request) {
  try {
    const auth = await getAccessWorkspaceUser();
    if (!auth) return Response.json({ error: "로그인이 필요합니다." }, { status: 401, headers });
    const parsed = z.object({ commentId: z.string().uuid() }).safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "댓글을 확인해 주세요." }, { status: 400, headers });
    const { error } = await auth.supabase.from("comment_notifications").update({ read_at: new Date().toISOString() }).eq("user_id", auth.userId).eq("comment_id", parsed.data.commentId).is("read_at", null);
    if (error) throw error;
    return Response.json({ ok: true }, { headers });
  } catch { return Response.json({ error: "알림을 확인 처리하지 못했어요." }, { status: 503, headers }); }
}
