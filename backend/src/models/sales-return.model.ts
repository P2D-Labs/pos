import { z } from "zod";

export const salesReturnCreateSchema = z.object({
  sourceInvoiceId: z.string(),
  customerId: z.string(),
  returnMethod: z.enum(["CASH_REFUND", "EXCHANGE"]),
  lines: z
    .array(
      z.object({
        salesInvoiceLineId: z.string(),
        enteredQuantity: z.number().positive(),
        reason: z.string().optional(),
      }),
    )
    .min(1),
});

export type SalesReturnCreateInput = z.infer<typeof salesReturnCreateSchema>;
