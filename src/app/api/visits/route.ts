import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { visitSchema } from "@/lib/schemas";
import { getAccessWorkspaceUser } from "@/lib/access-workspace";

async function authClient() {
  const workspace = await getAccessWorkspaceUser();
  if (!workspace) return null;
  return { supabase: workspace.supabase, user: { id: workspace.userId } };
}

async function isGroupMember(supabase: SupabaseClient, groupId: string, userId: string) {
  const { data, error } = await supabase.from("group_members").select("group_id").eq("group_id", groupId).eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

function visitWriteError(error: { code?: string; message?: string } | null, fallback: string) {
  if (error && (
    error.code === "PGRST204"
    || error.code === "42703"
    || (error.code === "23514" && error.message?.includes("marker_style"))
    || error.message?.includes("visits_marker_style_check")
  )) {
    return "새 맵핀을 저장하려면 Supabase에 최신 marker_style 마이그레이션을 적용해 주세요.";
  }
  if (error && (
    error.code === "22P02"
    || (error.message?.includes("smallint") && error.message.includes("rating"))
    || error.message?.includes('invalid input syntax for type smallint')
  )) {
    return "0.5 단위 별점을 저장하려면 데이터베이스 업데이트가 필요합니다. 최신 Supabase 마이그레이션을 적용해 주세요.";
  }
  return error?.message ?? fallback;
}

export async function POST(request: Request) {
  const auth = await authClient();
  if (!auth) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const parsed = visitSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  const input = parsed.data;
  if (!await isGroupMember(auth.supabase, input.groupId, auth.user.id)) return NextResponse.json({ error: "이 지도에 기록할 권한이 없습니다." }, { status: 403 });
  let placeId: string | undefined;
  if (input.place.provider === "kakao" && input.place.providerPlaceId) {
    const { data } = await auth.supabase
      .from("places")
      .select("id")
      .eq("group_id", input.groupId)
      .eq("provider", "kakao")
      .eq("provider_place_id", input.place.providerPlaceId)
      .maybeSingle();
    placeId = data?.id;
  }

  if (!placeId) {
    const { data, error } = await auth.supabase
      .from("places")
      .insert({
        group_id: input.groupId,
        provider: input.place.provider,
        provider_place_id: input.place.providerPlaceId ?? null,
        name: input.place.name,
        address: input.place.address,
        category: input.place.category,
        latitude: input.place.latitude,
        longitude: input.place.longitude,
        created_by: auth.user.id,
      })
      .select("id")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    placeId = data.id;
  }

  const visitPayload = {
    group_id: input.groupId,
    place_id: placeId,
    visited_on: input.visitedOn,
    is_planned: input.isPlanned,
    title: input.title,
    note: input.note,
    rating: input.rating,
    tags: input.tags,
    created_by: auth.user.id,
    updated_by: auth.user.id,
  };
  const { data: visit, error: visitError } = await auth.supabase
    .from("visits")
    .insert({ ...visitPayload, marker_style: input.markerStyle })
    .select("id,version")
    .single();
  if (visitError || !visit) return NextResponse.json({ error: visitWriteError(visitError, "방문 기록을 저장하지 못했습니다.") }, { status: 400 });

  if (input.participantIds.length) {
    const { error } = await auth.supabase.from("visit_participants").insert(
      input.participantIds.map((userId) => ({ visit_id: visit.id, user_id: userId })),
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ id: visit.id, version: visit.version }, { status: 201 });
}

export async function PUT(request: Request) {
  const auth = await authClient();
  if (!auth) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const parsed = visitSchema.safeParse(await request.json());
  if (!parsed.success || !parsed.data.id) {
    return NextResponse.json({ error: parsed.success ? "기록 ID가 필요합니다." : parsed.error.issues[0]?.message }, { status: 400 });
  }
  const input = parsed.data;
  const { data: currentVisit, error: currentVisitError } = await auth.supabase.from("visits").select("group_id").eq("id", input.id).maybeSingle();
  if (currentVisitError || !currentVisit) return NextResponse.json({ error: "방문 기록을 찾지 못했습니다." }, { status: 404 });
  if (!await isGroupMember(auth.supabase, currentVisit.group_id, auth.user.id)) return NextResponse.json({ error: "이 기록을 수정할 권한이 없습니다." }, { status: 403 });
  const updatePayload = {
    visited_on: input.visitedOn,
    is_planned: input.isPlanned,
    title: input.title,
    note: input.note,
    rating: input.rating,
    tags: input.tags,
    updated_by: auth.user.id,
    version: input.version + 1,
  };
  const { data, error } = await auth.supabase
    .from("visits")
    .update({ ...updatePayload, marker_style: input.markerStyle })
    .eq("id", input.id)
    .eq("version", input.version)
    .is("deleted_at", null)
    .select("id,version")
    .maybeSingle();
  if (error) return NextResponse.json({ error: visitWriteError(error, "방문 기록을 수정하지 못했습니다.") }, { status: 400 });
  if (!data) return NextResponse.json({ error: "다른 멤버가 먼저 수정했습니다. 최신 기록을 다시 불러와 주세요." }, { status: 409 });

  await auth.supabase.from("visit_participants").delete().eq("visit_id", input.id);
  if (input.participantIds.length) {
    await auth.supabase.from("visit_participants").insert(
      input.participantIds.map((userId) => ({ visit_id: input.id, user_id: userId })),
    );
  }
  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  const auth = await authClient();
  if (!auth) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const body = await request.json();
  if (typeof body.id !== "string" || typeof body.version !== "number") {
    return NextResponse.json({ error: "삭제할 기록 정보가 올바르지 않습니다." }, { status: 400 });
  }
  const { data: currentVisit, error: currentVisitError } = await auth.supabase
    .from("visits")
    .select("group_id,visit_photos(storage_path)")
    .eq("id", body.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (currentVisitError || !currentVisit) return NextResponse.json({ error: "방문 기록을 찾지 못했습니다." }, { status: 404 });
  if (!await isGroupMember(auth.supabase, currentVisit.group_id, auth.user.id)) return NextResponse.json({ error: "이 기록을 삭제할 권한이 없습니다." }, { status: 403 });
  const { data, error } = await auth.supabase
    .from("visits")
    .update({ deleted_at: new Date().toISOString(), updated_by: auth.user.id, version: body.version + 1 })
    .eq("id", body.id)
    .eq("version", body.version)
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "이미 변경된 기록입니다." }, { status: 409 });

  const photoPaths = (currentVisit.visit_photos ?? []).map((photo) => photo.storage_path).filter(Boolean);
  if (photoPaths.length) {
    const { error: storageError } = await auth.supabase.storage.from("visit-photos").remove(photoPaths);
    if (storageError) {
      await auth.supabase
        .from("visits")
        .update({ deleted_at: null, updated_by: auth.user.id, version: body.version })
        .eq("id", body.id)
        .eq("version", body.version + 1);
      return NextResponse.json({ error: "사진 저장소를 정리하지 못해 기록 삭제를 취소했습니다. 다시 시도해 주세요." }, { status: 502 });
    }
    await auth.supabase.from("visit_photos").delete().eq("visit_id", body.id);
  }

  return NextResponse.json({ ok: true, deletedPhotos: photoPaths.length });
}
