import { z } from "zod";

export const verifySessionQuerySchema = z.object({
  session_id: z.string().min(1, "session_id is required"),
});

export type VerifySessionQuery = z.infer<typeof verifySessionQuerySchema>;
