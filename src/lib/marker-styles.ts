export const MARKER_STYLE_IDS = [
  "pin-1", "pin-2", "pin-3", "pin-4", "pin-5", "pin-6", "pin-7", "pin-8", "pin-9", "pin-10",
  "pin-11", "pin-12", "pin-13", "pin-14", "pin-15", "pin-16", "pin-17", "pin-18", "pin-19", "pin-20",
  "pin-21", "pin-22", "pin-23", "pin-24", "pin-25", "pin-26", "pin-27", "pin-28", "pin-29", "pin-30",
  "pin-31", "pin-32", "pin-33", "pin-34", "pin-35", "pin-36", "pin-37", "pin-38", "pin-39", "pin-40",
] as const;
export type MarkerStyle = (typeof MARKER_STYLE_IDS)[number];

export const DEFAULT_MARKER_STYLE: MarkerStyle = "pin-1";

export function normalizeMarkerStyle(value: unknown): MarkerStyle {
  return MARKER_STYLE_IDS.includes(value as MarkerStyle) ? value as MarkerStyle : DEFAULT_MARKER_STYLE;
}

export function markerSvgDataUrl(value: unknown, options: { selected?: boolean; highlighted?: boolean } = {}) {
  const style = normalizeMarkerStyle(value);
  void options;
  return `/map-pins/${style}.png`;
}
