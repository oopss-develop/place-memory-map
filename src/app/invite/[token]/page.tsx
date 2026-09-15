import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
  const { error } = await supabase.rpc("accept_group_invite", { raw_token: token });
  if (error) redirect("/login?error=invite");
  redirect("/");
}
