import { NextResponse } from "next/server";
import { z } from "zod";
import { getAccessWorkspaceUser } from "@/lib/access-workspace";
import { routeSignature, sampleRoutePoints, type RouteStop } from "@/lib/trip-route";
import { tripError } from "@/lib/trip-server";
import type { TripRoute } from "@/types/domain";

export const runtime = "nodejs";
type Context = { params: Promise<{ tripId: string }> };
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
});
const providerSchema = z.enum(["kakao", "osm"]);

async function loadStops(auth: NonNullable<Awaited<ReturnType<typeof getAccessWorkspaceUser>>>, tripId: string, date: string) {
  const { data: trip, error: tripErrorResult } = await auth.supabase
    .from("trips").select("id,group_id,start_date,end_date")
    .eq("id", tripId).is("deleted_at", null).maybeSingle();
  if (tripErrorResult) throw tripErrorResult;
  if (!trip) return { response: NextResponse.json({ error: "여행을 찾을 수 없습니다." }, { status: 404 }) };
  if (date < trip.start_date || date > trip.end_date) {
    return { response: NextResponse.json({ error: "여행 기간 안의 날짜를 선택해 주세요." }, { status: 400 }) };
  }
  const nextDate = new Date(Date.parse(`${date}T00:00:00.000Z`) + 86_400_000).toISOString().slice(0, 10);

  const { data, error } = await auth.supabase.from("schedule_items")
    .select("id,starts_at,ends_at,place:places(name,latitude,longitude)")
    .eq("trip_id", tripId).is("deleted_at", null)
    .lt("starts_at", `${nextDate}T00:00:00`).gt("ends_at", `${date}T00:00:00`)
    .order("starts_at");
  if (error) throw error;
  const grouped = new Map<string, RouteStop>();
  for (const row of (data ?? []) as unknown as Array<{ id: string; starts_at: string; place: { name: string; latitude: number | string; longitude: number | string } }>) {
    const latitude = Number(row.place.latitude);
    const longitude = Number(row.place.longitude);
    const coordinateKey = `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
    if (!grouped.has(coordinateKey)) grouped.set(coordinateKey, { id: row.id, name: row.place.name, latitude, longitude });
  }
  return { trip, stops: [...grouped.values()] };
}

function toTripRoute(row: { route_kind: "road" | "straight"; route_points: unknown; distance_meters: number | null; duration_seconds: number | null }): TripRoute {
  const points = Array.isArray(row.route_points) ? row.route_points as TripRoute["points"] : [];
  return {
    kind: row.route_kind,
    points,
    ...(row.distance_meters === null ? {} : { distanceMeters: row.distance_meters }),
    ...(row.duration_seconds === null ? {} : { durationSeconds: row.duration_seconds }),
  };
}

async function get(request: Request, context: Context) {
  const auth = await getAccessWorkspaceUser();
  if (!auth) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const tripId = z.string().uuid().safeParse((await context.params).tripId);
  const url = new URL(request.url);
  const date = dateSchema.safeParse(url.searchParams.get("date"));
  const provider = providerSchema.safeParse(url.searchParams.get("provider"));
  if (!tripId.success || !date.success || !provider.success) return NextResponse.json({ error: "동선 정보가 올바르지 않습니다." }, { status: 400 });
  try {
    const loaded = await loadStops(auth, tripId.data, date.data);
    if ("response" in loaded) return loaded.response;
    if (loaded.stops.length < 2) return NextResponse.json({ route: null });
    const signature = routeSignature(tripId.data, date.data, provider.data, loaded.stops);
    const { data, error } = await auth.supabase.from("trip_route_cache").select("route_kind,route_points,distance_meters,duration_seconds")
      .eq("trip_id", tripId.data).eq("route_date", date.data).eq("provider", provider.data).eq("signature", signature).maybeSingle();
    if (error) throw error;
    return NextResponse.json({ route: data ? toTripRoute(data) : null });
  } catch (error) { return tripError(error); }
}

async function calculate(request: Request, context: Context) {
  const auth = await getAccessWorkspaceUser();
  if (!auth) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const tripId = z.string().uuid().safeParse((await context.params).tripId);
  const body = await request.json().catch(() => null);
  const parsed = z.object({ date: dateSchema, provider: providerSchema }).safeParse(body);
  if (!tripId.success || !parsed.success) return NextResponse.json({ error: "동선 정보가 올바르지 않습니다." }, { status: 400 });

  try {
    const loaded = await loadStops(auth, tripId.data, parsed.data.date);
    if ("response" in loaded) return loaded.response;
    if (loaded.stops.length < 2) return NextResponse.json({ error: "동선을 보려면 서로 다른 장소가 두 곳 이상 필요합니다." }, { status: 400 });
    const signature = routeSignature(tripId.data, parsed.data.date, parsed.data.provider, loaded.stops);
    const { data: cached, error: cacheError } = await auth.supabase.from("trip_route_cache")
      .select("route_kind,route_points,distance_meters,duration_seconds")
      .eq("trip_id", tripId.data).eq("route_date", parsed.data.date).eq("provider", parsed.data.provider).eq("signature", signature).maybeSingle();
    if (cacheError) throw cacheError;
    if (cached) return NextResponse.json({ route: toTripRoute(cached), cached: true });

    let route: TripRoute = { kind: "straight", points: loaded.stops.map(({ latitude, longitude }) => ({ latitude, longitude })) };
    let notice: string | undefined;
    const apiKey = process.env.KAKAO_REST_API_KEY;
    if (parsed.data.provider !== "kakao") {
      notice = "해외 지도에서는 장소 순서대로 직선으로 연결했어요.";
    } else if (!apiKey) {
      notice = "길찾기 키를 사용할 수 없어 장소 순서대로 연결했어요.";
    } else if (loaded.stops.length > 32) {
      notice = "장소가 32곳을 넘어 장소 순서대로 연결했어요.";
    } else {
      try {
        const [origin, ...remaining] = loaded.stops;
        const destination = remaining.pop()!;
        const body = {
          origin: { x: origin.longitude, y: origin.latitude, name: origin.name },
          destination: { x: destination.longitude, y: destination.latitude, name: destination.name },
          waypoints: remaining.map((stop) => ({ name: stop.name, x: stop.longitude, y: stop.latitude })),
          priority: "RECOMMEND",
          alternatives: false,
          road_details: false,
          summary: false,
        };
        const response = await fetch("https://apis-navi.kakaomobility.com/v1/waypoints/directions", {
          method: "POST",
          headers: { Authorization: `KakaoAK ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
          cache: "no-store",
          signal: AbortSignal.timeout(12_000),
        });
        if (!response.ok) throw new Error(`Kakao route request failed (${response.status})`);
        const result = await response.json() as {
          routes?: Array<{ result_code?: number; result_msg?: string; summary?: { distance?: number; duration?: number }; sections?: Array<{ roads?: Array<{ vertexes?: number[] }> }> }>;
        };
        const first = result.routes?.[0];
        const vertices = first?.sections?.flatMap((section) => section.roads?.flatMap((road) => road.vertexes ?? []) ?? []) ?? [];
        const points = Array.from({ length: Math.floor(vertices.length / 2) }, (_, index) => ({ longitude: Number(vertices[index * 2]), latitude: Number(vertices[index * 2 + 1]) }))
          .filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude));
        if (first?.result_code !== 0 || points.length < 2) throw new Error(first?.result_msg || "No route found");
        route = {
          kind: "road",
          points: sampleRoutePoints(points),
          ...(Number.isFinite(first.summary?.distance) ? { distanceMeters: first.summary!.distance } : {}),
          ...(Number.isFinite(first.summary?.duration) ? { durationSeconds: first.summary!.duration } : {}),
        };
      } catch {
        notice = "도로 경로를 찾지 못해 장소 순서대로 연결했어요.";
      }
    }

    const { data: saved, error } = await auth.supabase.rpc("save_trip_route", {
      target_trip_id: tripId.data,
      route_date: parsed.data.date,
      route_provider: parsed.data.provider,
      route_signature: signature,
      route_kind: route.kind,
      route_points: route.points,
      distance_meters: route.distanceMeters ?? null,
      duration_seconds: route.durationSeconds ?? null,
    });
    if (error) throw error;
    return NextResponse.json({ route: toTripRoute(saved), cached: false, ...(notice ? { notice } : {}) });
  } catch (error) { return tripError(error); }
}

export const GET = get;
export const POST = calculate;
