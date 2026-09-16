const memberInitialsByName: Record<string, string> = {
  "이교혁": "또",
  "박나린": "나",
  "박우성": "우",
  "이은지": "쥐",
};

export function getMemberInitials(displayName: string) {
  const normalizedName = displayName.trim();
  return memberInitialsByName[normalizedName] ?? normalizedName.slice(0, 1) ?? "?";
}
