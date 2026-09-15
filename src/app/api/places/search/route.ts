import { NextResponse } from "next/server";
import { placeSearchSchema } from "@/lib/schemas";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  if (!process.env.KAKAO_REST_API_KEY) {
    return NextResponse.json(
      { error: "장소 검색 키가 아직 연결되지 않았습니다." },
      { status: 503 },
    );
  }

  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const url = new URL(request.url);
  const parsed = placeSearchSchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
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
