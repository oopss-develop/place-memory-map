import { z } from "zod";
import { getAccessWorkspaceUser } from "@/lib/access-workspace";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const runtime = "nodejs";
const viewSchema = z.object({
  latitude: z.coerce.number().min(-85).max(85),
  longitude: z.coerce.number().min(-180).max(180),
  level: z.coerce.number().int().min(1).max(14),
});

// Use the documented static-map API. The REST key never leaves the server.
export async function GET(request: Request) {
  if (isSupabaseConfigured() && !await getAccessWorkspaceUser()) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const parsed = viewSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return Response.json({ error: "지도 범위를 확인해 주세요." }, { status: 400 });
  const key = process.env.KAKAO_REST_API_KEY;
  if (!key) return Response.json({ error: "지도 이미지 API 키가 연결되지 않았습니다." }, { status: 503 });
  const url = new URL("https://dapi.kakao.com/v2/maps/staticmap");
  url.searchParams.set("center", `${parsed.data.longitude},${parsed.data.latitude}`);
  url.searchParams.set("lv", String(parsed.data.level));
  url.searchParams.set("size", "960x600");
  url.searchParams.set("scale", "1");
  url.searchParams.set("format", "png");
  try {
    const response = await fetch(url, { headers: { Authorization: `KakaoAK ${key}` }, cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (!response.ok || !response.headers.get("content-type")?.startsWith("image/png")) return Response.json({ error: "카카오 지도 이미지를 가져오지 못했습니다." }, { status: response.status === 429 ? 429 : 502 });
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length > 8_000_000 || bytes[0] !== 137 || bytes[1] !== 80 || bytes[2] !== 78 || bytes[3] !== 71) return Response.json({ error: "지도 이미지 형식이 올바르지 않습니다." }, { status: 502 });
    return new Response(bytes, { headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return Response.json({ error: "지도 이미지 요청 시간이 초과되었거나 연결에 실패했습니다." }, { status: 502 });
  }
}
