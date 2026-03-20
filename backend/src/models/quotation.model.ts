import { z } from "zod";

export const quotationCreateSchema = z.object({
  customerId: z.string(),
  lines: z
    .array(
      z.object({
        itemId: z.string(),
        enteredQuantity: z.number().positive(),
        unitType: z.enum(["PRIMARY", "SECONDARY"]),
        unitId: z.string(),
        unitPrice: z.number().nonnegative(),
        discountAmount: z.number().nonnegative().default(0),
        taxRate: z.number().nonnegative().default(0),
      }),
    )
    .min(1),
});

export type QuotationCreateInput = z.infer<typeof quotationCreateSchema>;
