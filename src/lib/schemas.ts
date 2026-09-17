import { z } from "zod";
import { DEFAULT_MARKER_STYLE, MARKER_STYLE_IDS } from "@/lib/marker-styles";

export const placeSchema = z.object({
  provider: z.enum(["kakao", "manual"]),
  providerPlaceId: z.string().max(80).optional(),
  name: z.string().trim().min(1, "장소 이름을 입력해 주세요.").max(120),
  address: z.string().trim().max(240).default(""),
  category: z.string().trim().max(120).default("직접 지정"),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const visitSchema = z.object({
  id: z.string().uuid().optional(),
  groupId: z.string().uuid(),
  place: placeSchema,
  visitedOn: z.string().date(),
  isPlanned: z.boolean().default(false),
  title: z.string().trim().min(1, "기록 제목을 입력해 주세요.").max(120),
  note: z.string().trim().max(3000).default(""),
  rating: z.number().int().min(1).max(5),
  tags: z.array(z.string().trim().min(1).max(24)).max(8),
  participantIds: z.array(z.string().uuid()).max(20),
  markerStyle: z.enum(MARKER_STYLE_IDS).default(DEFAULT_MARKER_STYLE),
  version: z.number().int().positive().default(1),
});

export const placeSearchSchema = z.object({
  q: z.string().trim().min(2, "두 글자 이상 입력해 주세요.").max(80),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
});

export const magicLinkSchema = z.object({
  email: z.string().trim().email("이메일 주소를 확인해 주세요."),
});

export type VisitInput = z.infer<typeof visitSchema>;
