import { z } from "zod";

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(60),
  image: z.string().url().nullable().optional(),
  businessName: z.string().trim().max(100).optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
