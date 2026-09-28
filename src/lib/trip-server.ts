import "server-only";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeMarkerStyle } from "@/lib/marker-styles";
import type { ScheduleItem, Trip } from "@/types/domain";

export const tripColumns = "id,groupId:group_id,name,startDate:start_date,endDate:end_date,timeZone:time_zone,version";
const itemColumns = "id,groupId:group_id,tripId:trip_id,startsAt:starts_at,endsAt:ends_at,title,note,markerStyle:marker_style,version,place:places(id,provider,providerPlaceId:provider_place_id,name,address,category,latitude,longitude)";
export async function loadTripItems(db: SupabaseClient, tripId: string) {
  const { data, error } = await db.from("schedule_items").select(itemColumns).eq("trip_id", tripId).is("deleted_at", null).order("starts_at");
  if (error) throw error;
  return (data as unknown as ScheduleItem[]).map((item) => ({ ...item, startsAt: item.startsAt.slice(0, 16), endsAt: item.endsAt.slice(0, 16), markerStyle: normalizeMarkerStyle(item.markerStyle), place: { ...item.place, latitude: Number(item.place.latitude), longitude: Number(item.place.longitude) } }));
}
export async function loadTrips(db: SupabaseClient, groupId: string) {
  const { data, error } = await db.from("trips").select(tripColumns).eq("group_id", groupId).is("deleted_at", null).order("start_date");
  if (error) throw error;
  return data as Trip[];
}
export function tripError(error: unknown) {
  const issue = error as { code?: string; message?: string };
  const missing = ["42P01", "PGRST202", "PGRST205"].includes(issue.code ?? "");
  const message = missing ? "여행 계획 DB 업데이트가 필요합니다. 202609280001과 202609290001 마이그레이션을 적용해 주세요." : issue.message ?? "저장하지 못했습니다. 다시 시도해 주세요.";
  return NextResponse.json({ error: message }, { status: missing ? 503 : issue.code === "40001" ? 409 : issue.code === "42501" ? 403 : 400 });
}
