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

function parseMemberArray(raw = ""): unknown[] {
  let text = raw.trim();
  // .env loaders remove shell quotes; dashboard values can retain them literally.
  if (text.startsWith("'") && text.endsWith("'")) text = text.slice(1, -1).trim();
  try {
    let value: unknown = JSON.parse(text);
    if (typeof value === "string") value = JSON.parse(value);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function parseAllowedMembers(raw = ""): AllowedMember[] {
  if (!raw.trim()) return [];

  try {
    const value = parseMemberArray(raw);

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
  const configuredMembers = parseAllowedMembers(process.env.ALLOWED_MEMBERS_JSON);
  if (configuredMembers.length === 4) return configuredMembers;

  try {
    const value = parseMemberArray(process.env.ALLOWED_MEMBER_KEYS_JSON);
    return parseAllowedMembers(JSON.stringify(value));
  } catch {
    return [];
  }
}

export function getAllowedMember(email: string | null | undefined) {
  if (!email) return null;
  const normalized = normalizeEmail(email);
  return getAllowedMembers().find((member) => member.email === normalized) ?? null;
}

export function getAllowedMemberCredential(email: string | null | undefined, keyword: string | null | undefined) {
  if (!email || !keyword) return null;

  try {
    const value = parseMemberArray(process.env.ALLOWED_MEMBER_KEYS_JSON);

    return value.find((item): item is { email: string; keyword: string; displayName?: string } => (
      item !== null && typeof item === "object" &&
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
