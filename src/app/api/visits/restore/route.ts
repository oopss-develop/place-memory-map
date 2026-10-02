import { NextResponse } from "next/server";
import { z } from "zod";
import { getAccessWorkspaceUser } from "@/lib/access-workspace";
export async function POST(request: Request) {
  const auth = await getAccessWorkspaceUser();
  if (!auth) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const parsed = z.object({ id: z.string().uuid(), version: z.number().int().positive() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "복원할 기록을 확인해 주세요." }, { status: 400 });
  const { data, error } = await auth.supabase.rpc("restore_visit", { target_id: parsed.data.id, expected_version: parsed.data.version });
  if (error) return NextResponse.json({ error: error.message }, { status: error.code === "42501" ? 403 : error.code === "40001" ? 409 : error.code === "P0002" ? 410 : 400 });
  return NextResponse.json(data);
}
