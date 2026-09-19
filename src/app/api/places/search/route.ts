import { NextResponse } from "next/server";
import { placeSearchSchema } from "@/lib/schemas";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getAccessWorkspaceUser } from "@/lib/access-workspace";

export async function GET(request: Request) {
  if (isSupabaseConfigured() && !await getAccessWorkspaceUser()) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const url = new URL(request.url);
  const parsed = placeSearchSchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  if (parsed.data.map === "osm") {
    const nominatimUrl = new URL("https://nominatim.openstreetmap.org/search");
    nominatimUrl.searchParams.set("q", parsed.data.q);
    nominatimUrl.searchParams.set("format", "jsonv2");
    nominatimUrl.searchParams.set("addressdetails", "1");
    nominatimUrl.searchParams.set("limit", "10");
    nominatimUrl.searchParams.set("accept-language", "ko");
    const response = await fetch(nominatimUrl, {
      headers: {
        "User-Agent": `PlaceMemoryMap/1.0 (${new URL(request.url).origin})`,
        "Accept-Language": "ko,en;q=0.8",
      },
      next: { revalidate: 86400 },
    });
    if (!response.ok) {
      return NextResponse.json({ error: response.status === 429 ? "해외 장소 검색 요청이 많습니다. 잠시 후 다시 시도해 주세요." : "해외 장소 검색에 잠시 문제가 생겼습니다." }, { status: response.status === 429 ? 429 : 502 });
    }
    const payload: Array<{ place_id: number; name?: string; display_name: string; lat: string; lon: string; type?: string }> = await response.json();
    return NextResponse.json({
      results: payload.map((item) => ({
        id: `osm-${item.place_id}`,
        placeName: item.name || item.display_name.split(",")[0] || "해외 장소",
        addressName: item.display_name,
        roadAddressName: item.display_name,
        categoryName: item.type || "해외 장소",
        latitude: Number(item.lat),
        longitude: Number(item.lon),
      })),
    });
  }

  if (!process.env.KAKAO_REST_API_KEY) {
    return NextResponse.json({ error: "장소 검색 키가 아직 연결되지 않았습니다." }, { status: 503 });
  }

  const kakaoUrl = new URL("https://dapi.kakao.com/v2/local/search/keyword.json");
  kakaoUrl.searchParams.set("query", parsed.data.q);
  kakaoUrl.searchParams.set("size", "10");
  if (parsed.data.latitude != null && parsed.data.longitude != null) {
    kakaoUrl.searchParams.set("y", String(parsed.data.latitude));
    kakaoUrl.searchParams.set("x", String(parsed.data.longitude));
    kakaoUrl.searchParams.set("sort", "distance");
  }

  const response = await fetch(kakaoUrl, {
    headers: { Authorization: `KakaoAK ${process.env.KAKAO_REST_API_KEY}` },
    cache: "no-store",
  });

  if (!response.ok) {
    const status = response.status === 429 ? 429 : 502;
    return NextResponse.json(
      { error: status === 429 ? "오늘의 장소 검색 한도를 모두 사용했습니다. 직접 핀을 추가해 주세요." : "장소 검색에 잠시 문제가 생겼습니다." },
      { status },
    );
  }

  const payload: { documents: Array<{ id: string; place_name: string; address_name: string; road_address_name: string; category_name: string; x: string; y: string }> } = await response.json();
  return NextResponse.json({
    results: payload.documents.map((item) => ({
      id: item.id,
      placeName: item.place_name,
      addressName: item.address_name,
      roadAddressName: item.road_address_name,
      categoryName: item.category_name,
      latitude: Number(item.y),
      longitude: Number(item.x),
    })),
  });
}
