import { NextResponse } from "next/server";
import { z } from "zod";
import { getAccessWorkspaceUser } from "@/lib/access-workspace";

const visitIdSchema = z.string().uuid();

export async function POST(request: Request, context: { params: Promise<{ visitId: string }> }) {
  const { visitId } = await context.params;
  if (!visitIdSchema.safeParse(visitId).success) return NextResponse.json({ error: "방문 기록 정보가 올바르지 않습니다." }, { status: 400 });
  const workspace = await getAccessWorkspaceUser();
  if (!workspace) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { data: visit, error: visitError } = await workspace.supabase.from("visits").select("group_id").eq("id", visitId).is("deleted_at", null).maybeSingle();
  if (visitError || !visit) return NextResponse.json({ error: "방문 기록을 찾지 못했습니다." }, { status: 404 });
  const { data: membership } = await workspace.supabase.from("group_members").select("group_id").eq("group_id", visit.group_id).eq("user_id", workspace.userId).maybeSingle();
  if (!membership) return NextResponse.json({ error: "이 기록에 사진을 추가할 권한이 없습니다." }, { status: 403 });

  const formData = await request.formData();
  const files = formData.getAll("photos").filter((item): item is File => item instanceof File).slice(0, 5);
  if (!files.length) return NextResponse.json({ error: "사진을 선택해 주세요." }, { status: 400 });
  if (files.some((file) => file.type !== "image/webp" || file.size > 1_572_864)) return NextResponse.json({ error: "WebP 형식의 1.5MB 이하 사진만 추가할 수 있어요." }, { status: 400 });

  const { data: existingPhotos, error: existingError } = await workspace.supabase.from("visit_photos").select("sort_order").eq("visit_id", visitId).order("sort_order", { ascending: false });
  if (existingError) return NextResponse.json({ error: "기존 사진을 확인하지 못했습니다." }, { status: 500 });
  const startingOrder = existingPhotos?.length ?? 0;
  if (startingOrder + files.length > 5) return NextResponse.json({ error: "사진은 최대 5장까지 추가할 수 있어요." }, { status: 400 });

  const photoUrls: string[] = [];
  for (const [index, file] of files.entries()) {
    const path = `${visit.group_id}/${visitId}/${crypto.randomUUID()}.webp`;
    const { error: uploadError } = await workspace.supabase.storage.from("visit-photos").upload(path, Buffer.from(await file.arrayBuffer()), { contentType: "image/webp", upsert: false });
    if (uploadError) return NextResponse.json({ error: "사진을 저장하지 못했습니다." }, { status: 400 });
    const { error: photoError } = await workspace.supabase.from("visit_photos").insert({ visit_id: visitId, storage_path: path, sort_order: startingOrder + index, uploaded_by: workspace.userId });
    if (photoError) return NextResponse.json({ error: "사진 정보를 저장하지 못했습니다." }, { status: 400 });
    const { data: signed } = await workspace.supabase.storage.from("visit-photos").createSignedUrl(path, 3600);
    if (signed?.signedUrl) photoUrls.push(signed.signedUrl);
  }
  return NextResponse.json({ photoUrls }, { status: 201 });
}
