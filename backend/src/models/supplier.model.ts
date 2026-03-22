import { z } from "zod";

export const supplierSchema = z.object({
  code: z.string().optional(),
  name: z.string().min(2),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  billingAddress: z.string().optional(),
  taxNo: z.string().optional(),
  paymentTermsDays: z.number().int().nonnegative().optional(),
  openingBalance: z.number().optional(),
  isActive: z.boolean().optional(),
  notes: z.string().optional(),
});

export const supplierListQuerySchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
});

export const supplierUpdateSchema = supplierSchema.partial();

export type SupplierInput = z.infer<typeof supplierSchema>;
