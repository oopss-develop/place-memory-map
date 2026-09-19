import "server-only";

export interface AllowedMember {
  email: string;
  displayName: string;
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

export function safeNextPath(value: string | null | undefined) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}
