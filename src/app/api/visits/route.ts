import { NextResponse } from "next/server";
import { visitSchema } from "@/lib/schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

async function authClient() {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  return { supabase, user: data.user };
}

export async function POST(request: Request) {
  const auth = await authClient();
  if (!auth) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const parsed = visitSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  const input = parsed.data;
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

  const { data: visit, error: visitError } = await auth.supabase
    .from("visits")
    .insert({
      group_id: input.groupId,
      place_id: placeId,
      visited_on: input.visitedOn,
      title: input.title,
      note: input.note,
      rating: input.rating,
      tags: input.tags,
      created_by: auth.user.id,
      updated_by: auth.user.id,
    })
    .select("id,version")
    .single();
  if (visitError) return NextResponse.json({ error: visitError.message }, { status: 400 });

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
  const { data, error } = await auth.supabase
    .from("visits")
    .update({
      visited_on: input.visitedOn,
      title: input.title,
      note: input.note,
      rating: input.rating,
      tags: input.tags,
      updated_by: auth.user.id,
      version: input.version + 1,
    })
    .eq("id", input.id)
    .eq("version", input.version)
    .is("deleted_at", null)
    .select("id,version")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
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
  const { data, error } = await auth.supabase
    .from("visits")
    .update({ deleted_at: new Date().toISOString(), updated_by: auth.user.id, version: body.version + 1 })
    .eq("id", body.id)
    .eq("version", body.version)
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "이미 변경된 기록입니다." }, { status: 409 });
  return NextResponse.json({ ok: true });
}
