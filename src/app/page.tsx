import { redirect } from "next/navigation";
import { MapJournal } from "@/components/map-journal";
import { getDashboardData } from "@/lib/data";
import { getAccessWorkspaceUser } from "@/lib/access-workspace";
import { synchronizeSharedMaps } from "@/lib/shared-maps";
import { z } from "zod";

export const dynamic = "force-dynamic";

export default async function Home(props: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await props?.searchParams ?? {};
  const parsed = z.object({ groupId: z.string().uuid().optional(), visitId: z.string().uuid().optional(), tripId: z.string().uuid().optional(), view: z.literal("travel").optional() }).safeParse(params);
  const navigation = parsed.success ? parsed.data : { error: "이 링크를 열 수 없습니다. 모아보기에서 다시 선택해 주세요." };
  const forcedDemo = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  if (forcedDemo) {
    return <MapJournal initialData={await getDashboardData()} initialNavigation={navigation} viewerId="demo-viewer" viewerName="여행자" />;
  }

  const workspace = await getAccessWorkspaceUser();
  if (!workspace) redirect("/login");
  await synchronizeSharedMaps();
  let data;
  let selectedNavigation = navigation;
  try {
    data = await getDashboardData(workspace.supabase, workspace.userId, parsed.success ? parsed.data.groupId : undefined);
  } catch (error) {
    if ((error as { status?: number }).status !== 403) throw error;
    data = await getDashboardData(workspace.supabase, workspace.userId);
    selectedNavigation = { error: "이 지도는 삭제되었거나 접근 권한이 없습니다." };
  }
  return <MapJournal initialData={data} initialNavigation={selectedNavigation} viewerId={workspace.userId} viewerName={workspace.member.displayName} />;
}
