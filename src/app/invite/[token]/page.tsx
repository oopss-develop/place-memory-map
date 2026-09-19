import { redirect } from "next/navigation";
import { getAccessWorkspaceUser } from "@/lib/access-workspace";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const workspace = await getAccessWorkspaceUser();
  if (!workspace) redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
  const { error } = await workspace.supabase.rpc("accept_group_invite", { raw_token: token });
  if (error) redirect("/login?error=invite");
  redirect("/");
}
