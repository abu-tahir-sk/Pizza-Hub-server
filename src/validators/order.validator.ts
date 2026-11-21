import { z } from "zod";

export const createOrderSchema = z.object({
  itemId: z.string().min(1),
  deliveryDate: z.coerce.date(),
  deliveryAddress: z.string().trim().min(5).max(300),
  message: z.string().trim().max(500).optional().default(""),
  quantity: z.coerce.number().int().min(1).max(20).optional().default(1),
});

export const decideOrderSchema = z.object({
  status: z.enum(["pending", "accepted", "rejected", "cancelled"]),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type DecideOrderInput = z.infer<typeof decideOrderSchema>;
