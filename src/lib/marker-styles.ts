export const MARKER_STYLE_IDS = [
  "color-1", "color-2", "color-3", "color-4", "color-5", "color-6", "color-7", "color-8",
  "color-9", "color-10", "color-11", "color-12", "color-13", "color-14", "color-15", "color-16",
  "black-1", "black-2", "black-3", "black-4", "black-5", "black-6", "black-7", "black-8",
  "black-9", "black-10", "black-11", "black-12", "black-13", "black-14", "black-15", "black-16",
  "square-cat-color", "square-cat-black", "square-plane-color", "square-plane-black", "square-gamepad-color", "square-gamepad-black",
  "round-cat-color", "round-cat-black", "round-plane-color", "round-plane-black", "round-gamepad-color", "round-gamepad-black",
] as const;
export type MarkerStyle = (typeof MARKER_STYLE_IDS)[number];

export const DEFAULT_MARKER_STYLE: MarkerStyle = "black-1";

export function normalizeMarkerStyle(value: unknown): MarkerStyle {
  return MARKER_STYLE_IDS.includes(value as MarkerStyle) ? value as MarkerStyle : DEFAULT_MARKER_STYLE;
}

export function markerSvgDataUrl(value: unknown, options: { selected?: boolean; highlighted?: boolean } = {}) {
  const style = normalizeMarkerStyle(value);
  void options;
  return `/map-pins/${style}.png`;
}
