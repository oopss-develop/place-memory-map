export const THEME_IDS = ["notebook", "pure", "dark", "forest", "lavender"] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export const THEME_OPTIONS: Array<{ id: ThemeId; label: string; description: string; swatch: string }> = [
  { id: "notebook", label: "노트", description: "따스한 기록장", swatch: "#d84c32" },
  { id: "pure", label: "퓨어", description: "맑고 가벼운 화면", swatch: "#287998" },
  { id: "dark", label: "다크", description: "눈이 편한 어두운 화면", swatch: "#ff987e" },
  { id: "forest", label: "포레스트", description: "차분한 초록빛", swatch: "#3f7456" },
  { id: "lavender", label: "라벤더", description: "서늘한 보랏빛", swatch: "#a85e76" },
];

export const DEFAULT_THEME: ThemeId = "notebook";

export function normalizeTheme(value: unknown): ThemeId {
  return THEME_IDS.includes(value as ThemeId) ? value as ThemeId : DEFAULT_THEME;
}
