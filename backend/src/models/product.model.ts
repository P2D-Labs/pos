import { z } from "zod";

export const productSchema = z.object({
  name: z.string().min(2),
  type: z.enum(["PRODUCT", "SERVICE"]).default("PRODUCT"),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  code: z.string().optional(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  categoryId: z.string().optional(),
  subCategoryId: z.string().optional(),
  subCategory: z.string().optional(),
  brandId: z.string().optional(),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  trackInventory: z.boolean().default(true),
  allowNegativeStock: z.boolean().default(false),
  primaryUnitId: z.string().optional(),
  secondaryUnitId: z.string().optional(),
  secondaryToPrimaryFactor: z.number().positive().optional(),
  allowSalesInSecondaryUnit: z.boolean().default(false),
  allowPurchaseInSecondaryUnit: z.boolean().default(false),
  allowSecondaryFraction: z.boolean().default(false),
  openingStockPrimary: z.number().nonnegative().optional(),
  reorderLevelPrimary: z.number().nonnegative().optional(),
  salesPricePrimary: z.number().nonnegative().optional(),
  purchasePricePrimary: z.number().nonnegative().optional(),
  taxable: z.boolean().default(true),
  defaultTaxRateId: z.string().optional(),
  notes: z.string().optional(),
});

export const productListQuerySchema = z.object({
  search: z.string().optional(),
  categoryId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(20),
});

export const productUpdateSchema = productSchema.partial();

export type ProductInput = z.infer<typeof productSchema>;
