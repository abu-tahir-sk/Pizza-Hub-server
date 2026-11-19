import { z } from "zod";

export const blockStatusSchema = z.object({
  isBlocked: z.boolean(),
});

export const menuStatusSchema = z.object({
  status: z.enum(["approved", "rejected", "inactive"]),
  rejectionReason: z.string().trim().max(300).optional(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().catch(1),
  limit: z.coerce.number().int().positive().catch(10),
});

export type BlockStatusInput = z.infer<typeof blockStatusSchema>;
export type MenuStatusInput = z.infer<typeof menuStatusSchema>;
