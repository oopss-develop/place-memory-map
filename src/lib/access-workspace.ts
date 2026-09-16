import "server-only";
import { accessMembers, getAccessMemberFromCookies, type AccessMember } from "@/lib/access-auth";
import { isServerPersistenceConfigured } from "@/lib/supabase/config";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

async function ensureAccessProfiles(supabase: AdminClient) {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;

  const users = new Map(data.users.map((user) => [user.email, user]));
  const identities = await Promise.all(Object.values(accessMembers).map(async (member) => {
    let user = users.get(member.email);
    if (!user) {
      const { data: created, error: createError } = await supabase.auth.admin.createUser({
        email: member.email,
        email_confirm: true,
        user_metadata: { display_name: member.displayName },
      });
      if (createError || !created.user) throw createError ?? new Error("간편 로그인 계정을 만들지 못했습니다.");
      user = created.user;
    }
    return { ...member, userId: user.id };
  }));

  const { error: profileError } = await supabase.from("profiles").upsert(
    identities.map((identity) => ({ id: identity.userId, display_name: identity.displayName })),
  );
  if (profileError) throw profileError;
  return identities;
}

export async function getAccessWorkspaceUser() {
  if (!isServerPersistenceConfigured()) return null;
  const member = await getAccessMemberFromCookies();
  if (!member) return null;

  const supabase = createSupabaseAdminClient();
  const identities = await ensureAccessProfiles(supabase);
  const identity = identities.find((item) => item.email === member.email);
  if (!identity) throw new Error("간편 로그인 사용자를 찾지 못했습니다.");
  return { supabase, userId: identity.userId, member, identities };
}

export async function requireAccessWorkspaceUser() {
  const workspace = await getAccessWorkspaceUser();
  if (!workspace) return null;
  return workspace;
}

export type AccessWorkspaceMember = AccessMember & { userId: string };
