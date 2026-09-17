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

const MARKER_STYLE_FILES: Record<MarkerStyle, string> = {
  "color-1": "coral-food-square.png",
  "color-2": "brown-cafe-square.png",
  "color-3": "blue-luggage-square.png",
  "color-4": "purple-camera-square.png",
  "color-5": "pink-heart-square.png",
  "color-6": "orange-shopping-square.png",
  "color-7": "green-hotel-square.png",
  "color-8": "yellow-sparkle-square.png",
  "color-9": "coral-food-round.png",
  "color-10": "brown-cafe-round.png",
  "color-11": "blue-luggage-round.png",
  "color-12": "purple-camera-round.png",
  "color-13": "pink-heart-round.png",
  "color-14": "orange-shopping-round.png",
  "color-15": "green-hotel-round.png",
  "color-16": "yellow-sparkle-round.png",
  "black-1": "black-food-square.png",
  "black-2": "black-cafe-square.png",
  "black-3": "black-luggage-square.png",
  "black-4": "black-camera-square.png",
  "black-5": "black-heart-square.png",
  "black-6": "black-shopping-square.png",
  "black-7": "black-hotel-square.png",
  "black-8": "black-sparkle-square.png",
  "black-9": "black-food-round.png",
  "black-10": "black-cafe-round.png",
  "black-11": "black-luggage-round.png",
  "black-12": "black-camera-round.png",
  "black-13": "black-heart-round.png",
  "black-14": "black-shopping-round.png",
  "black-15": "black-hotel-round.png",
  "black-16": "black-sparkle-round.png",
  "square-cat-color": "teal-cat-square.png",
  "square-cat-black": "black-cat-square.png",
  "square-plane-color": "orange-plane-square.png",
  "square-plane-black": "black-plane-square.png",
  "square-gamepad-color": "green-gamepad-square.png",
  "square-gamepad-black": "black-gamepad-square.png",
  "round-cat-color": "teal-cat-round.png",
  "round-cat-black": "black-cat-round.png",
  "round-plane-color": "orange-plane-round.png",
  "round-plane-black": "black-plane-round.png",
  "round-gamepad-color": "green-gamepad-round.png",
  "round-gamepad-black": "black-gamepad-round.png",
};

export function normalizeMarkerStyle(value: unknown): MarkerStyle {
  return MARKER_STYLE_IDS.includes(value as MarkerStyle) ? value as MarkerStyle : DEFAULT_MARKER_STYLE;
}

export function markerSvgDataUrl(value: unknown, options: { selected?: boolean; highlighted?: boolean } = {}) {
  const style = normalizeMarkerStyle(value);
  void options;
  return `/map-pins/${MARKER_STYLE_FILES[style]}`;
}
