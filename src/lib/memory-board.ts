import { z } from "zod";
import type { Visit } from "@/types/domain";

export const BOARD_WIDTH = 1200;
export const BOARD_HEIGHT = 840;
export const BOARD_LIMIT = 80;
export const boardItemSchema = z.object({
  id: z.string().uuid(), kind: z.enum(["photo", "note"]),
  x: z.number().finite().min(0).max(BOARD_WIDTH), y: z.number().finite().min(0).max(BOARD_HEIGHT),
  width: z.number().finite().min(120).max(560), height: z.number().finite().min(100).max(600),
  rotation: z.number().finite().min(-180).max(180),
  text: z.string().max(500), color: z.enum(["cream", "rose", "sage", "sky"]),
  attachment: z.enum(["tape", "pin"]), visitId: z.string().max(100).optional(), photoId: z.string().max(100).optional(),
}).superRefine((item, ctx) => {
  if (item.x + item.width > BOARD_WIDTH || item.y + item.height > BOARD_HEIGHT)
    ctx.addIssue({ code: "custom", message: "사진과 메모는 보드 안에 놓아 주세요." });
  if (item.kind === "photo" && (!item.visitId || !item.photoId))
    ctx.addIssue({ code: "custom", message: "붙일 사진을 선택해 주세요." });
});
export const boardContentSchema = z.object({
  background: z.enum(["pegboard", "whiteboard", "cork"]), items: z.array(boardItemSchema).max(BOARD_LIMIT),
}).refine(value => new Set(value.items.map(item => item.id)).size === value.items.length, "보드 항목이 중복되었습니다.");
export type BoardItem = z.infer<typeof boardItemSchema>;
export type BoardContent = z.infer<typeof boardContentSchema>;
export interface MemoryBoard extends BoardContent { version: number }
export const emptyBoard = (): MemoryBoard => ({ background: "pegboard", items: [], version: 0 });
export const saveBoardSchema = boardContentSchema.and(z.object({
  groupId: z.string().uuid(), version: z.number().int().nonnegative(), requestId: z.string().uuid(),
}));
export function clampBoardItem(item: BoardItem): BoardItem {
  const width = Math.max(120, Math.min(560, item.width));
  const height = Math.max(100, Math.min(600, item.height));
  return { ...item, width, height, x: Math.max(0, Math.min(BOARD_WIDTH - width, item.x)),
    y: Math.max(0, Math.min(BOARD_HEIGHT - height, item.y)), rotation: ((item.rotation + 180) % 360 + 360) % 360 - 180 };
}
export function boardPhotos(visits: Visit[]) {
  return visits.filter(visit => !visit.deletedAt && !visit.isPlanned).flatMap(visit => visit.photoUrls.map((url, index) => ({
    key: `${visit.id}:${visit.photoIds?.[index] ?? `demo-${index}`}`, visitId: visit.id,
    photoId: visit.photoIds?.[index] ?? `demo-${index}`, url, title: visit.title, place: visit.place.name, date: visit.visitedOn,
  })));
}
export function resolveBoardPhoto(item: BoardItem, visits: Visit[]) {
  return boardPhotos(visits).find(photo => photo.visitId === item.visitId && photo.photoId === item.photoId);
}
