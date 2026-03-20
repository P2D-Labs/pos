import { z } from "zod";

export const salesOrderCreateSchema = z.object({
  customerId: z.string(),
  documentTaxMode: z.enum(["TAX", "NON_TAX"]),
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

export type SalesOrderCreateInput = z.infer<typeof salesOrderCreateSchema>;
