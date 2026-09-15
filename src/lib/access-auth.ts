import { cookies } from "next/headers";

export const ACCESS_COOKIE = "place-memory-access";

const accessMembers = {
  또: { displayName: "이교혁", initials: "이" },
  나: { displayName: "박나린", initials: "박" },
  우: { displayName: "박우성", initials: "박" },
  쥐: { displayName: "이은지", initials: "이" },
} as const;

export type AccessCode = keyof typeof accessMembers;
export type AccessMember = (typeof accessMembers)[AccessCode];

export function getAccessMember(code: string | undefined): AccessMember | null {
  if (!code || !Object.hasOwn(accessMembers, code)) return null;
  return accessMembers[code as AccessCode];
}

export async function getAccessMemberFromCookies(): Promise<AccessMember | null> {
  const cookieStore = await cookies();
  return getAccessMember(cookieStore.get(ACCESS_COOKIE)?.value);
}
