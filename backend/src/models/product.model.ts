import { z } from "zod";

export const productSchema = z.object({
  name: z.string().min(2),
  type: z.enum(["PRODUCT", "SERVICE"]).default("PRODUCT"),
  trackInventory: z.boolean().default(true),
  primaryUnitId: z.string().optional(),
  secondaryUnitId: z.string().optional(),
  secondaryToPrimaryFactor: z.number().positive().optional(),
  salesPricePrimary: z.number().nonnegative().optional(),
  purchasePricePrimary: z.number().nonnegative().optional(),
  taxable: z.boolean().default(true),
});

export const productListQuerySchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
});

export type ProductInput = z.infer<typeof productSchema>;
