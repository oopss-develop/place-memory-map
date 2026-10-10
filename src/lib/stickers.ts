import catalog from "@/generated/stickers.json";
export interface Sticker { id: string; name: string; src: string; animated: boolean; previewSrc?: string }
export interface StickerSeries { id: string; name: string; stickers: Sticker[] }
export const stickerSeries: StickerSeries[] = catalog;
const stickers = new Map(stickerSeries.flatMap(series => series.stickers.map(sticker => [sticker.id, sticker] as const)));
export function resolveSticker(id: string | null | undefined): Sticker | null { return id ? stickers.get(id) ?? null : null; }
