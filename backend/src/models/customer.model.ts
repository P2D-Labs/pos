import { z } from "zod";

export const customerSchema = z.object({
  code: z.string().optional(),
  name: z.string().min(2),
  customerType: z.enum(["REGULAR", "WALK_IN"]).default("REGULAR"),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  billingAddress: z.string().optional(),
  shippingAddress: z.string().optional(),
  taxNo: z.string().optional(),
  creditLimit: z.number().nonnegative().optional(),
  paymentTermsDays: z.number().int().nonnegative().optional(),
  openingBalance: z.number().optional(),
  isActive: z.boolean().optional(),
  notes: z.string().optional(),
});

export const customerListQuerySchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
});

export const customerUpdateSchema = customerSchema.partial();

export type CustomerInput = z.infer<typeof customerSchema>;
