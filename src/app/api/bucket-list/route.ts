import { NextResponse } from "next/server";
import { z } from "zod";
import { getAccessWorkspaceUser } from "@/lib/access-workspace";
import { bucketSchema } from "@/lib/bucket-list";
import { readPages } from "@/lib/data";
const status = (code?: string) => code === "42501" ? 403 : code === "40001" ? 409 : code === "P0002" ? 404 : ["PGRST202", "42P01"].includes(code ?? "") ? 503 : 400;
export async function GET(request: Request) {
  const auth = await getAccessWorkspaceUser();
  if (!auth) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const group = z.string().uuid().safeParse(new URL(request.url).searchParams.get("groupId"));
  if (!group.success) return NextResponse.json({ error: "지도를 확인해 주세요." }, { status: 400 });
  try {
    const items = await readPages((from, to) => auth.supabase.from("bucket_items").select("*").eq("group_id", group.data).is("deleted_at", null).order("created_at", { ascending: false }).order("id").range(from, to));
    return NextResponse.json({ items }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return NextResponse.json({ error: "버킷리스트를 불러오지 못했습니다. 저장소 업데이트 여부를 확인해 주세요." }, { status: status((error as { code?: string }).code) }); }
}
async function save(request: Request, creating: boolean) {
  const auth = await getAccessWorkspaceUser();
  if (!auth) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const parsed = bucketSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "입력을 확인해 주세요." }, { status: 400 });
  const { data, error } = await auth.supabase.rpc("save_bucket_item", { input: parsed.data, creating });
  if (error) return NextResponse.json({ error: error.code === "PGRST202" ? "버킷리스트 저장소 업데이트가 필요합니다." : error.message }, { status: status(error.code) });
  return NextResponse.json(data, { status: creating ? 201 : 200 });
}
export async function POST(request: Request) { return save(request, true); }
export async function PUT(request: Request) { return save(request, false); }
export async function DELETE(request: Request) {
  const auth = await getAccessWorkspaceUser();
  if (!auth) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const parsed = z.object({ id: z.string().uuid(), version: z.number().int().positive() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "삭제할 항목을 확인해 주세요." }, { status: 400 });
  const { error } = await auth.supabase.rpc("delete_bucket_item", { target_id: parsed.data.id, expected_version: parsed.data.version });
  return error ? NextResponse.json({ error: error.message }, { status: status(error.code) }) : NextResponse.json({ ok: true });
}
