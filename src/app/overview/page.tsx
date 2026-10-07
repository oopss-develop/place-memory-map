import { redirect } from "next/navigation";
import { getAccessWorkspaceUser } from "@/lib/access-workspace";
import { OverviewScreen } from "@/components/overview-screen";

export const dynamic = "force-dynamic";
export default async function OverviewPage() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") return <OverviewScreen demo userId="demo-viewer" />;
  const auth = await getAccessWorkspaceUser();
  if (!auth) redirect("/login?next=%2Foverview");
  return <OverviewScreen userId={auth.userId} />;
}
