import "server-only";
import { getAllowedMember } from "@/lib/access-auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getAccessWorkspaceUser() {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  const member = getAllowedMember(data.user?.email);
  if (error || !data.user || !member) return null;
  return { supabase, userId: data.user.id, member };
}

export async function requireAccessWorkspaceUser() {
  return getAccessWorkspaceUser();
}

export type AccessWorkspaceMember = NonNullable<Awaited<ReturnType<typeof getAccessWorkspaceUser>>>["member"] & { userId: string };
