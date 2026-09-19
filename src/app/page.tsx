import { redirect } from "next/navigation";
import { MapJournal } from "@/components/map-journal";
import { getDashboardData } from "@/lib/data";
import { getAccessWorkspaceUser } from "@/lib/access-workspace";

export const dynamic = "force-dynamic";

export default async function Home() {
  const forcedDemo = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  if (forcedDemo) {
    return <MapJournal initialData={await getDashboardData()} viewerId="demo-viewer" viewerName="여행자" />;
  }

  const workspace = await getAccessWorkspaceUser();
  if (!workspace) redirect("/login");
  return <MapJournal initialData={await getDashboardData(workspace.supabase, workspace.userId)} viewerId={workspace.userId} viewerName={workspace.member.displayName} />;
}
