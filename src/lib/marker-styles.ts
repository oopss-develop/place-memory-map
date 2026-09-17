export const MARKER_STYLE_IDS = [
  "color-1", "color-2", "color-3", "color-4", "color-5", "color-6", "color-7", "color-8",
  "color-9", "color-10", "color-11", "color-12", "color-13", "color-14", "color-15", "color-16",
  "black-1", "black-2", "black-3", "black-4", "black-5", "black-6", "black-7", "black-8",
  "black-9", "black-10", "black-11", "black-12", "black-13", "black-14", "black-15", "black-16",
  "square-cat-color", "square-cat-black", "square-plane-color", "square-plane-black", "square-gamepad-color", "square-gamepad-black",
  "round-cat-color", "round-cat-black", "round-plane-color", "round-plane-black", "round-gamepad-color", "round-gamepad-black",
] as const;
export type MarkerStyle = (typeof MARKER_STYLE_IDS)[number];

// Keep the picker grouped by icon, then color, then shape.
export const MARKER_PICKER_STYLE_IDS: MarkerStyle[] = [
  "color-1", "color-9", "black-1", "black-9",
  "color-2", "color-10", "black-2", "black-10",
  "color-3", "color-11", "black-3", "black-11",
  "color-4", "color-12", "black-4", "black-12",
  "color-5", "color-13", "black-5", "black-13",
  "color-6", "color-14", "black-6", "black-14",
  "color-7", "color-15", "black-7", "black-15",
  "color-8", "color-16", "black-8", "black-16",
  "square-cat-color", "round-cat-color", "square-cat-black", "round-cat-black",
  "square-plane-color", "round-plane-color", "square-plane-black", "round-plane-black",
  "square-gamepad-color", "round-gamepad-color", "square-gamepad-black", "round-gamepad-black",
];

export const DEFAULT_MARKER_STYLE: MarkerStyle = "black-1";

const MARKER_STYLE_FILES: Record<MarkerStyle, string> = {
  "color-1": "food-coral-square.png",
  "color-2": "cafe-brown-square.png",
  "color-3": "luggage-blue-square.png",
  "color-4": "camera-purple-square.png",
  "color-5": "heart-pink-square.png",
  "color-6": "shopping-orange-square.png",
  "color-7": "hotel-green-square.png",
  "color-8": "sparkle-yellow-square.png",
  "color-9": "food-coral-round.png",
  "color-10": "cafe-brown-round.png",
  "color-11": "luggage-blue-round.png",
  "color-12": "camera-purple-round.png",
  "color-13": "heart-pink-round.png",
  "color-14": "shopping-orange-round.png",
  "color-15": "hotel-green-round.png",
  "color-16": "sparkle-yellow-round.png",
  "black-1": "food-black-square.png",
  "black-2": "cafe-black-square.png",
  "black-3": "luggage-black-square.png",
  "black-4": "camera-black-square.png",
  "black-5": "heart-black-square.png",
  "black-6": "shopping-black-square.png",
  "black-7": "hotel-black-square.png",
  "black-8": "sparkle-black-square.png",
  "black-9": "food-black-round.png",
  "black-10": "cafe-black-round.png",
  "black-11": "luggage-black-round.png",
  "black-12": "camera-black-round.png",
  "black-13": "heart-black-round.png",
  "black-14": "shopping-black-round.png",
  "black-15": "hotel-black-round.png",
  "black-16": "sparkle-black-round.png",
  "square-cat-color": "cat-teal-square.png",
  "square-cat-black": "cat-black-square.png",
  "square-plane-color": "plane-orange-square.png",
  "square-plane-black": "plane-black-square.png",
  "square-gamepad-color": "gamepad-green-square.png",
  "square-gamepad-black": "gamepad-black-square.png",
  "round-cat-color": "cat-teal-round.png",
  "round-cat-black": "cat-black-round.png",
  "round-plane-color": "plane-orange-round.png",
  "round-plane-black": "plane-black-round.png",
  "round-gamepad-color": "gamepad-green-round.png",
  "round-gamepad-black": "gamepad-black-round.png",
};

export function normalizeMarkerStyle(value: unknown): MarkerStyle {
  return MARKER_STYLE_IDS.includes(value as MarkerStyle) ? value as MarkerStyle : DEFAULT_MARKER_STYLE;
}

export function markerSvgDataUrl(value: unknown, options: { selected?: boolean; highlighted?: boolean } = {}) {
  const style = normalizeMarkerStyle(value);
  void options;
  return `/map-pins/${MARKER_STYLE_FILES[style]}`;
}
