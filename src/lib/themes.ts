export const THEME_IDS = ["notebook", "pure", "dark", "forest", "lavender"] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export const THEME_OPTIONS: Array<{ id: ThemeId; label: string; description: string; swatch: string }> = [
  { id: "notebook", label: "뉴트럴", description: "흰색과 회색의 기본 화면", swatch: "#18181b" },
  { id: "pure", label: "블루", description: "파란색 포인트", swatch: "#0369a1" },
  { id: "dark", label: "다크", description: "어두운 배경의 화면", swatch: "#27272a" },
  { id: "forest", label: "그린", description: "초록색 포인트", swatch: "#166534" },
  { id: "lavender", label: "바이올렛", description: "보라색 포인트", swatch: "#6d28d9" },
];

export const DEFAULT_THEME: ThemeId = "notebook";

export function normalizeTheme(value: unknown): ThemeId {
  return THEME_IDS.includes(value as ThemeId) ? value as ThemeId : DEFAULT_THEME;
}
