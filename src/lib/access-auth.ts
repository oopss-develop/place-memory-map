import "server-only";

export interface AllowedMember {
  email: string;
  displayName: string;
}

export interface AllowedMemberCredential extends AllowedMember {
  keyword: string;
}

function normalizeEmail(email: string) {
  return email.trim().toLocaleLowerCase("en-US");
}

export function parseAllowedMembers(raw = ""): AllowedMember[] {
  if (!raw.trim()) return [];

  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];

    const members = value.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const email = "email" in item && typeof item.email === "string" ? normalizeEmail(item.email) : "";
      const displayName = "displayName" in item && typeof item.displayName === "string" ? item.displayName.trim() : "";
      if (!email || !displayName || !email.includes("@")) return [];
      return [{ email, displayName }];
    });

    return Array.from(new Map(members.map((member) => [member.email, member])).values());
  } catch {
    return [];
  }
}

export function getAllowedMembers() {
  return parseAllowedMembers(process.env.ALLOWED_MEMBERS_JSON);
}

export function getAllowedMember(email: string | null | undefined) {
  if (!email) return null;
  const normalized = normalizeEmail(email);
  return getAllowedMembers().find((member) => member.email === normalized) ?? null;
}

export function getAllowedMemberCredential(email: string | null | undefined, keyword: string | null | undefined) {
  if (!email || !keyword) return null;

  try {
    const value: unknown = JSON.parse(process.env.ALLOWED_MEMBER_KEYS_JSON ?? "");
    if (!Array.isArray(value)) return null;

    return value.find((item): item is { email: string; keyword: string; displayName?: string } => (
      Boolean(item) && typeof item === "object" &&
      "email" in item && typeof item.email === "string" &&
      "keyword" in item && typeof item.keyword === "string" &&
      normalizeEmail(item.email) === normalizeEmail(email) && item.keyword === keyword
    )) ?? null;
  } catch {
    return null;
  }
}

export function safeNextPath(value: string | null | undefined) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}
