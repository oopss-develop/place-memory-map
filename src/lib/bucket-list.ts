import { z } from "zod";
import { placeSchema } from "./schemas";
import type { BucketItem, Visit } from "@/types/domain";
export const bucketSchema = z.object({
  id: z.string().uuid(), groupId: z.string().uuid(),
  title: z.string().trim().min(1, "제목을 입력해 주세요.").max(120),
  kind: z.enum(["place", "activity"]),
  reason: z.string().trim().max(3000).default(""),
  place: placeSchema.extend({ id: z.string().uuid().optional() }).nullable().default(null),
  tags: z.array(z.string().trim().min(1).max(24)).max(8).default([]),
  version: z.number().int().positive().default(1), requestId: z.string().uuid(),
});
export function bucketStatus(item: BucketItem, visits: Visit[]) {
  const visit = visits.find(visit => visit.id === item.visit_id && visit.groupId === item.group_id && !visit.deletedAt);
  return visit ? visit.isPlanned ? "planned" : "completed" : "wish";
}
