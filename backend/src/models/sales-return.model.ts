import { z } from "zod";

export const salesReturnCreateSchema = z.object({
  sourceInvoiceId: z.string(),
  customerId: z.string(),
  /** Ignored — returns always credit the customer's store balance (no staff-facing refund vs exchange). */
  returnMethod: z.enum(["CASH_REFUND", "EXCHANGE"]).optional(),
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
