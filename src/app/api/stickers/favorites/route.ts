import { z } from "zod";
import { getAccessWorkspaceUser } from "@/lib/access-workspace";
import { resolveSticker } from "@/lib/stickers";
export async function POST(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const auth = await getAccessWorkspaceUser();
    if (!auth) return Response.json({ error: "로그인이 필요합니다." }, { status: 401, headers });
    const parsed = z.object({ stickerId: z.string().max(512), favorite: z.boolean() }).safeParse(await request.json().catch(() => null));
    if (!parsed.success || !resolveSticker(parsed.data.stickerId)) return Response.json({ error: "이모티콘을 다시 선택해 주세요." }, { status: 400, headers });
    const { stickerId, favorite } = parsed.data;
    const result = favorite
      ? await auth.supabase.from("sticker_favorites").insert({ user_id: auth.userId, sticker_id: stickerId })
      : await auth.supabase.from("sticker_favorites").delete().eq("user_id", auth.userId).eq("sticker_id", stickerId);
    if (result.error && !(favorite && result.error.code === "23505")) return Response.json({ error: "즐겨찾기를 저장하지 못했어요. 다시 시도해 주세요." }, { status: 503, headers });
    return Response.json({ ok: true }, { headers });
  } catch { return Response.json({ error: "즐겨찾기를 저장하지 못했어요." }, { status: 503, headers }); }
}
