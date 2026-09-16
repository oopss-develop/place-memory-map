export const MARKER_STYLE_IDS = ["pin-1", "pin-2", "pin-3", "pin-4", "pin-5"] as const;
export type MarkerStyle = (typeof MARKER_STYLE_IDS)[number];

export const DEFAULT_MARKER_STYLE: MarkerStyle = "pin-1";

export function normalizeMarkerStyle(value: unknown): MarkerStyle {
  return MARKER_STYLE_IDS.includes(value as MarkerStyle) ? value as MarkerStyle : DEFAULT_MARKER_STYLE;
}

const colors: Record<MarkerStyle, string> = {
  "pin-1": "#d84c32",
  "pin-2": "#315a6b",
  "pin-3": "#697855",
  "pin-4": "#b27235",
  "pin-5": "#755a82",
};

function markerBody(style: MarkerStyle, fill: string) {
  switch (style) {
    case "pin-2":
      return `<path d="M9 4h30a6 6 0 0 1 6 6v25a6 6 0 0 1-6 6h-8L24 56l-7-15H9a6 6 0 0 1-6-6V10a6 6 0 0 1 6-6Z" fill="${fill}"/><path d="m24 13 9 9-9 9-9-9 9-9Z" fill="#fffdf6"/>`;
    case "pin-3":
      return `<path d="M17 3h21l7 8-7 8H21v37h-7V7a4 4 0 0 1 3-4Z" fill="${fill}"/><circle cx="18" cy="53" r="4" fill="#fffdf6"/>`;
    case "pin-4":
      return `<path d="m24 2 18 11v23L24 56 6 36V13L24 2Z" fill="${fill}"/><path d="M24 12 34 22 24 36 14 22l10-10Z" fill="#fffdf6"/>`;
    case "pin-5":
      return `<path d="M24 2C12 2 4 10 4 22c0 14 20 34 20 34s20-20 20-34C44 10 36 2 24 2Z" fill="${fill}"/><path d="m24 10 3.7 7.5 8.3 1.2-6 5.8 1.4 8.2-7.4-3.9-7.4 3.9 1.4-8.2-6-5.8 8.3-1.2L24 10Z" fill="#fffdf6"/>`;
    default:
      return `<path d="M24 2C12 2 4 10.8 4 22.5 4 36.8 24 56 24 56s20-19.2 20-33.5C44 10.8 36 2 24 2Z" fill="${fill}"/><circle cx="24" cy="22" r="7" fill="#fffdf6"/>`;
  }
}

export function markerSvgDataUrl(value: unknown, options: { selected?: boolean; highlighted?: boolean } = {}) {
  const style = normalizeMarkerStyle(value);
  const fill = options.selected ? "#a93324" : options.highlighted ? "#d84c32" : colors[style];
  const strokeWidth = options.selected || options.highlighted ? 3 : 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="58" viewBox="0 0 48 58"><g stroke="#fffdf6" stroke-width="${strokeWidth}" stroke-linejoin="round">${markerBody(style, fill)}</g></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
