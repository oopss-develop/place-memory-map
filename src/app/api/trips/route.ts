import { NextResponse } from "next/server";
import { z } from "zod";
import { getAccessWorkspaceUser } from "@/lib/access-workspace";
import { deleteScheduleSchema, tripSchema } from "@/lib/timetable";
import { loadTrips, tripError } from "@/lib/trip-server";

export async function GET(request: Request) {
  const auth = await getAccessWorkspaceUser();
  if (!auth) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const id = z.string().uuid().safeParse(new URL(request.url).searchParams.get("groupId"));
  if (!id.success) return NextResponse.json({ error: "지도를 선택해 주세요." }, { status: 400 });
  try { return NextResponse.json({ trips: await loadTrips(auth.supabase, id.data) }); } catch (error) { return tripError(error); }
}
async function write(request: Request, deleting = false) {
  const auth = await getAccessWorkspaceUser();
  if (!auth) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  try {
    const body = await request.json();
    if (deleting) {
      const parsed = deleteScheduleSchema.safeParse(body);
      if (!parsed.success) return NextResponse.json({ error: "삭제할 여행 정보가 올바르지 않습니다." }, { status: 400 });
      const { error } = await auth.supabase.rpc("delete_trip", { target_id: parsed.data.id, expected_version: parsed.data.version });
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }
    const parsed = tripSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    const { data: saved, error } = await auth.supabase.rpc("save_trip", { payload: parsed.data });
    if (error) throw error;
    return NextResponse.json({ savedTripId: saved.id, trips: await loadTrips(auth.supabase, parsed.data.groupId) });
  } catch (error) { return tripError(error); }
}
export const POST = (request: Request) => write(request);
export const PUT = (request: Request) => write(request);
export const DELETE = (request: Request) => write(request, true);
