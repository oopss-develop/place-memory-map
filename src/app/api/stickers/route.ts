import { stickerSeries, resolveSticker } from "@/lib/stickers";
import { getAccessWorkspaceUser } from "@/lib/access-workspace";
export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const auth = await getAccessWorkspaceUser();
    if (!auth) return Response.json({ series: stickerSeries, favorites: [], signedIn: false }, { headers });
    const { data, error } = await auth.supabase.from("sticker_favorites").select("sticker_id").eq("user_id", auth.userId);
    return Response.json({ series: stickerSeries, favorites: (data ?? []).map(row => row.sticker_id).filter(id => resolveSticker(id)), signedIn: true, ...(error ? { favoritesError: "즐겨찾기를 불러오지 못했어요. DB 변경 적용 후 다시 열어 주세요." } : {}) }, { headers });
  } catch { return Response.json({ error: "이모티콘을 불러오지 못했어요." }, { status: 503, headers }); }
}
