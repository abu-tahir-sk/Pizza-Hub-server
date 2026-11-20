import { z } from "zod";
import { MENU_CATEGORIES } from "../models/menuItem.model.js";

export const createItemSchema = z.object({
  itemName: z.string().trim().min(2).max(100),
  category: z.enum(MENU_CATEGORIES),
  description: z.string().trim().min(10).max(1000),
  price: z.coerce.number().min(0).max(100000),
  location: z.string().trim().min(2).max(120),
  images: z.array(z.string().url()).min(1).max(5),
  vendorId: z.string().optional(),
  status: z.enum(["pending", "approved", "inactive"]).optional(),
});

/** Vendors may edit content and toggle availability — never approval status. */
export const updateItemSchema = createItemSchema.partial().extend({
  status: z.enum(["active", "inactive"]).optional(),
});

/** Lenient on purpose: unknown query keys and invalid filters are ignored. */
export const listMenuQuerySchema = z
  .object({
    search: z.string().optional(),
    category: z.string().optional(),
    location: z.string().optional(),
    minPrice: z.coerce.number().optional(),
    maxPrice: z.coerce.number().optional(),
    vendorId: z.string().optional(),
    sortBy: z.enum(["price", "createdAt"]).optional(),
    sortDir: z.enum(["asc", "desc"]).optional(),
    page: z.coerce.number().int().positive().catch(1),
    limit: z.coerce.number().int().positive().catch(9),
  })
  .passthrough();

export type CreateItemInput = z.infer<typeof createItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
export type ListMenuQuery = z.infer<typeof listMenuQuerySchema>;
