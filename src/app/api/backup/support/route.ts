import { getAccessWorkspaceUser } from "@/lib/access-workspace";
import support from "@/generated/backup-support.json";
export async function GET() {
  if (!await getAccessWorkspaceUser()) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  return Response.json(support, { headers: { "Cache-Control": "private, no-store" } });
}
