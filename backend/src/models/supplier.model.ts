import { z } from "zod";

export const supplierSchema = z.object({
  name: z.string().min(2),
  phone: z.string().optional(),
  email: z.string().optional(),
});

export const supplierListQuerySchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
});

export type SupplierInput = z.infer<typeof supplierSchema>;
