import { z } from "zod";

export const customerSchema = z.object({
  name: z.string().min(2),
  customerType: z.enum(["REGULAR", "WALK_IN"]).default("REGULAR"),
  phone: z.string().optional(),
  email: z.string().optional(),
});

export const customerListQuerySchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
});

export type CustomerInput = z.infer<typeof customerSchema>;
