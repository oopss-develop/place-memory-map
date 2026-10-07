import { NextResponse } from "next/server";
import { z } from "zod";
import { getAccessWorkspaceUser } from "@/lib/access-workspace";
import { loadOverviewSnapshot, materializeOverview } from "@/lib/overview-server";

export async function GET(request: Request) {
  const auth = await getAccessWorkspaceUser();
  if (!auth) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const url = new URL(request.url);
  const parsed = z.object({ groupId: z.string().uuid().optional(), period: z.enum(["all", "year", "month"]) }).safeParse({ groupId: url.searchParams.get("groupId") ?? undefined, period: url.searchParams.get("period") ?? "all" });
  if (!parsed.success) return NextResponse.json({ error: "지도와 기간을 다시 선택해 주세요." }, { status: 400 });
  try {
    const snapshot = await loadOverviewSnapshot(auth.supabase, auth.userId, parsed.data.period, parsed.data.groupId);
    const headers = { ETag: snapshot.etag, "Cache-Control": "private, no-store" };
    if (!snapshot.data?.photoWarning && url.searchParams.get("renewPhotos") !== "true" && request.headers.get("If-None-Match") === snapshot.etag) return new Response(null, { status: 304, headers });
    return NextResponse.json(await materializeOverview(auth.supabase, snapshot), { headers });
  } catch (error) {
    return NextResponse.json({ error: "모아보기를 불러오지 못했습니다. 다시 시도해 주세요." }, { status: (error as { status?: number }).status ?? 503 });
  }
}
