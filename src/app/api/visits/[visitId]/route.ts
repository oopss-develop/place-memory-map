import { NextResponse } from "next/server";
import { z } from "zod";
import { getAccessWorkspaceUser } from "@/lib/access-workspace";
import { loadVisitSnapshot, materializeDashboard } from "@/lib/data";

export async function GET(request: Request, { params }: { params: Promise<{ visitId: string }> }) {
  const auth = await getAccessWorkspaceUser();
  if (!auth) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const { visitId } = await params;
  if (!z.string().uuid().safeParse(visitId).success) return NextResponse.json({ error: "기록을 확인해 주세요." }, { status: 400 });
  try {
    const snapshot = await loadVisitSnapshot(auth.supabase, auth.userId, visitId);
    if (!snapshot) return NextResponse.json({ error: "이 기록은 삭제되었거나 접근 권한이 없습니다." }, { status: 404 });
    const headers = { ETag: snapshot.etag, "Cache-Control": "private, no-store" };
    if (new URL(request.url).searchParams.get("renewPhotos") !== "true" && request.headers.get("If-None-Match") === snapshot.etag) return new Response(null, { status: 304, headers });
    const data = await materializeDashboard(auth.supabase, snapshot);
    return NextResponse.json({ visit: data.visits[0], groupName: data.groups[0].name, photoWarning: data.photoWarning }, { headers });
  } catch { return NextResponse.json({ error: "기록을 불러오지 못했습니다. 다시 시도해 주세요." }, { status: 503 }); }
}
