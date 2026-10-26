import { NextResponse } from "next/server";
import { z } from "zod";
import { getAccessWorkspaceUser } from "@/lib/access-workspace";
import { readPages } from "@/lib/data";
type Context = { params: Promise<{ bucketId: string }> };
export async function GET(request: Request, context: Context) {
  const auth = await getAccessWorkspaceUser();
  if (!auth) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const id = z.string().uuid().safeParse((await context.params).bucketId);
  if (!id.success) return NextResponse.json({ error: "항목을 확인해 주세요." }, { status: 400 });
  try {
    const comments = await readPages((from, to) => auth.supabase.from("bucket_comments").select("*,profiles(display_name)").eq("bucket_id", id.data).order("created_at").order("id").range(from, to));
    return NextResponse.json({ comments }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "댓글을 불러오지 못했습니다." }, { status: 400 }); }
}
async function write(request: Request, context: Context, removing: boolean) {
  const auth = await getAccessWorkspaceUser();
  if (!auth) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const parsed = z.object({ id: z.string().uuid(), body: z.string().trim().max(1000).default("") }).safeParse(await request.json().catch(() => null));
  const id = z.string().uuid().safeParse((await context.params).bucketId);
  if (!parsed.success || !id.success || (!removing && !parsed.data.body)) return NextResponse.json({ error: "댓글을 1~1000자로 입력해 주세요." }, { status: 400 });
  const { data, error } = await auth.supabase.rpc("write_bucket_comment", { target_id: id.data, comment_id: parsed.data.id, comment_body: parsed.data.body, removing });
  if (error) return NextResponse.json({ error: error.message }, { status: error.code === "42501" ? 403 : ["40001", "PT409"].includes(error.code ?? "") ? 409 : 400 });
  return NextResponse.json(data);
}
export async function POST(request: Request, context: Context) { return write(request, context, false); }
export async function DELETE(request: Request, context: Context) { return write(request, context, true); }
