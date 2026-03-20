import { z } from "zod";

export const purchaseCreateSchema = z.object({
  supplierId: z.string(),
  lines: z
    .array(
      z.object({
        itemId: z.string(),
        enteredQuantity: z.number().positive(),
        unitType: z.enum(["PRIMARY", "SECONDARY"]),
        unitId: z.string(),
        unitCost: z.number().nonnegative(),
        taxRate: z.number().nonnegative().default(0),
      }),
    )
    .min(1),
  amountPaid: z.number().nonnegative().default(0),
});

export type PurchaseCreateInput = z.infer<typeof purchaseCreateSchema>;
