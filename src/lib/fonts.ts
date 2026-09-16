export const FONT_STORAGE_KEY = "place-memory-font-v1";
export const FONT_OPTIONS = [
  { id: "noto", label: "노토 산스", description: "또렷하고 익숙한 기본 글꼴", family: "var(--font-noto), sans-serif" },
  { id: "nanum-square", label: "나눔스퀘어", description: "반듯하고 시원한 고딕체", family: '"NanumSquare", var(--font-noto), sans-serif' },
  { id: "gowun", label: "고운바탕", description: "차분한 책 느낌의 명조체", family: "var(--font-gowun), serif" },
  { id: "system", label: "기기 기본", description: "휴대폰·컴퓨터의 기본 글꼴", family: "system-ui, sans-serif" },
] as const;
export type FontId = (typeof FONT_OPTIONS)[number]["id"];
export const DEFAULT_FONT: FontId = "noto";
export function normalizeFont(value: unknown): FontId {
  return FONT_OPTIONS.find((font) => font.id === value)?.id ?? DEFAULT_FONT;
}
