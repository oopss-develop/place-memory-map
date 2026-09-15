import { redirect } from "next/navigation";
import { MapJournal } from "@/components/map-journal";
import { getDashboardData } from "@/lib/data";
import { getAccessMemberFromCookies } from "@/lib/access-auth";
import { getAccessWorkspaceUser } from "@/lib/access-workspace";

export const dynamic = "force-dynamic";

export default async function Home() {
  const forcedDemo = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  const member = await getAccessMemberFromCookies();
  if (!forcedDemo && !member) redirect("/login");
  const workspace = await getAccessWorkspaceUser();
  return <MapJournal initialData={await getDashboardData(workspace?.userId)} viewerId={workspace?.userId ?? member?.id ?? "access-또"} viewerName={member?.displayName} />;
}
