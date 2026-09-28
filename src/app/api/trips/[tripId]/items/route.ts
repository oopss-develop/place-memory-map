import { NextResponse } from "next/server";
import { z } from "zod";
import { getAccessWorkspaceUser } from "@/lib/access-workspace";
import { deleteScheduleSchema, scheduleSchema } from "@/lib/timetable";
import { loadTripItems, tripColumns, tripError } from "@/lib/trip-server";

type Context = { params: Promise<{ tripId: string }> };
async function handle(request: Request, context: Context) {
  const auth = await getAccessWorkspaceUser();
  if (!auth) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const parsedId = z.string().uuid().safeParse((await context.params).tripId);
  if (!parsedId.success) return NextResponse.json({ error: "여행 정보가 올바르지 않습니다." }, { status: 400 });
  const tripId = parsedId.data;
  try {
    if (request.method !== "GET") {
      const body = await request.json();
      if (request.method === "DELETE") {
        const parsed = deleteScheduleSchema.safeParse(body);
        if (!parsed.success) return NextResponse.json({ error: "삭제할 일정 정보가 올바르지 않습니다." }, { status: 400 });
        const { error } = await auth.supabase.rpc("delete_schedule_item", { target_trip_id: tripId, target_id: parsed.data.id, expected_version: parsed.data.version });
        if (error) throw error;
      } else {
        const parsed = scheduleSchema.safeParse(body);
        if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
        const { error } = await auth.supabase.rpc("save_schedule_item", { target_trip_id: tripId, payload: parsed.data });
        if (error) throw error;
      }
    }
    const { data: trip, error } = await auth.supabase.from("trips").select(tripColumns).eq("id", tripId).is("deleted_at", null).maybeSingle();
    if (error) throw error;
    if (!trip) return NextResponse.json({ error: "여행을 찾을 수 없습니다." }, { status: 404 });
    return NextResponse.json({ trip, items: await loadTripItems(auth.supabase, tripId) });
  } catch (error) { return tripError(error); }
}
export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
