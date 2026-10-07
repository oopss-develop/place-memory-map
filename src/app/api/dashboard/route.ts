import { NextResponse } from "next/server";
import { z } from "zod";
import { getAccessWorkspaceUser } from "@/lib/access-workspace";
import { loadDashboardSnapshot, materializeDashboard } from "@/lib/data";

export async function GET(request: Request) {
  const auth = await getAccessWorkspaceUser();
  if (!auth) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const url = new URL(request.url);
  const parsed = z.string().uuid().optional().safeParse(url.searchParams.get("groupId") ?? undefined);
  if (!parsed.success) return NextResponse.json({ error: "지도를 선택해 주세요." }, { status: 400 });
  try {
    const snapshot = await loadDashboardSnapshot(auth.supabase, auth.userId, parsed.data);
    const headers = { ETag: snapshot.etag, "Cache-Control": "private, no-store" };
    if (url.searchParams.get("renewPhotos") !== "true" && request.headers.get("If-None-Match") === snapshot.etag) return new Response(null, { status: 304, headers });
    return NextResponse.json(await materializeDashboard(auth.supabase, snapshot), { headers });
  } catch (error) {
    return NextResponse.json({ error: "기록을 불러오지 못했습니다. 다시 시도해 주세요." }, { status: (error as { status?: number }).status ?? 503 });
  }
}
