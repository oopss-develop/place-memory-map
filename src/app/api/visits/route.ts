import { NextResponse } from "next/server";
import { z } from "zod";
import { visitSchema } from "@/lib/schemas";
import { getAccessWorkspaceUser } from "@/lib/access-workspace";

const rpcStatus = (code?: string) => code === "42501" ? 403 : code === "40001" ? 409 : code === "P0002" ? 404 : code === "PGRST202" || code === "42703" ? 503 : 400;
async function save(request: Request, creating: boolean) {
  const auth = await getAccessWorkspaceUser();
  if (!auth) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const parsed = visitSchema.extend({ requestId: z.string().uuid().optional() }).safeParse(body);
  if (!parsed.success || (!creating && !parsed.data.id)) return NextResponse.json({ error: "기록 입력을 확인해 주세요." }, { status: 400 });
  const { data, error } = await auth.supabase.rpc("save_visit", { input: parsed.data, request_id: parsed.data.requestId ?? crypto.randomUUID(), creating });
  if (error) return NextResponse.json({ error: error.code === "PGRST202" ? "저장소 업데이트가 필요합니다. 관리자에게 문의해 주세요." : error.message }, { status: rpcStatus(error.code) });
  return NextResponse.json(data, { status: creating ? 201 : 200 });
}
export async function POST(request: Request) { return save(request, true); }
export async function PUT(request: Request) { return save(request, false); }
export async function DELETE(request: Request) {
  const auth = await getAccessWorkspaceUser();
  if (!auth) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const parsed = z.object({ id: z.string().uuid(), version: z.number().int().positive() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "삭제할 기록을 확인해 주세요." }, { status: 400 });
  const { data, error } = await auth.supabase.from("visits").update({ deleted_at: new Date().toISOString(), updated_by: auth.userId, version: parsed.data.version + 1 }).eq("id", parsed.data.id).eq("version", parsed.data.version).is("deleted_at", null).select("id,version,deleted_at").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "이미 변경되었거나 접근할 수 없는 기록입니다." }, { status: 409 });
  return NextResponse.json({ ok: true, ...data });
}
