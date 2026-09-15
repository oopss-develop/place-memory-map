import { cookies } from "next/headers";

export const ACCESS_COOKIE = "place-memory-access";

export const accessMembers = {
  또: { id: "access-또", email: "place-memory-map-ggyo@users.invalid", displayName: "이교혁", initials: "이" },
  나: { id: "access-나", email: "place-memory-map-narin@users.invalid", displayName: "박나린", initials: "박" },
  우: { id: "access-우", email: "place-memory-map-woosung@users.invalid", displayName: "박우성", initials: "박" },
  쥐: { id: "access-쥐", email: "place-memory-map-eunji@users.invalid", displayName: "이은지", initials: "이" },
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
