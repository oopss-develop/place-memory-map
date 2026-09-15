import { redirect } from "next/navigation";
import { MapJournal } from "@/components/map-journal";
import { getDashboardData } from "@/lib/data";
import { getAccessMemberFromCookies } from "@/lib/access-auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const forcedDemo = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  const member = await getAccessMemberFromCookies();
  if (!forcedDemo && !member) redirect("/login");
  return <MapJournal initialData={await getDashboardData()} viewerId={member?.id ?? "access-또"} viewerName={member?.displayName} />;
}
