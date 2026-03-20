import { z } from "zod";

export const stockAdjustmentSchema = z.object({
  itemId: z.string(),
  enteredQuantity: z.number().positive(),
  unitType: z.enum(["PRIMARY", "SECONDARY"]),
  unitId: z.string(),
  direction: z.enum(["IN", "OUT"]),
  note: z.string().optional(),
});

export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;
