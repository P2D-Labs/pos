import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { HttpError } from "../lib/http";
import type { AuthUser } from "../middleware/auth";
import { enforceNonTaxPermission, hasPermission } from "../middleware/permissions";
import { listQuerySchema } from "../models/common.model";
import PDFDocument from "pdfkit";
import { z } from "zod";

function parseQueryDateStart(value: string) {
  return value.includes("T") ? new Date(value) : new Date(`${value}T00:00:00.000`);
}

function parseQueryDateEnd(value: string) {
  return value.includes("T") ? new Date(value) : new Date(`${value}T23:59:59.999`);
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(value: Date) {
  return value.toISOString().replace("T", " ").slice(0, 19);
}

function templateFooterText(template: unknown, fallback = "Thank you for your business.") {
  if (template && typeof template === "object" && !Array.isArray(template)) {
    const footerText = (template as Record<string, unknown>).footerText;
    if (typeof footerText === "string" && footerText.trim()) return footerText.trim();
  }
  return fallback;
}

async function loadItemUnitMaps(businessId: string, itemIds: string[], unitIds: string[]) {
  const uniqueItems = [...new Set(itemIds.filter(Boolean))];
  const uniqueUnits = [...new Set(unitIds.filter(Boolean))];
  const [unitRows, itemRows] = await Promise.all([
    uniqueUnits.length
      ? prisma.unit.findMany({
          where: { businessId, id: { in: uniqueUnits } },
          select: { id: true, symbol: true },
        })
      : Promise.resolve([]),
    uniqueItems.length
      ? prisma.item.findMany({
          where: { businessId, id: { in: uniqueItems } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);
  return {
    unitMap: new Map(unitRows.map((u) => [u.id, u.symbol])),
    itemMap: new Map(itemRows.map((i) => [i.id, i.name])),
  };
}

type PdfLineRow = {
  itemLabel: string;
  quantity: string;
  unitLabel: string;
  rate: string;
  taxAmount: string;
  lineTotal: string;
};

const reprintSearchQuerySchema = listQuerySchema.extend({
  invoiceNo: z.string().optional(),
  customerId: z.string().optional(),
  customerName: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  grandTotalMin: z.coerce.number().optional(),
  grandTotalMax: z.coerce.number().optional(),
  itemId: z.string().optional(),
  itemSearch: z.string().optional(),
});

async function buildPdfBuffer(
  title: string,
  metadata: Array<{ label: string; value: string }>,
  lines: PdfLineRow[],
  summary: {
    subtotal: string;
    discount: string;
    tax: string;
    grandTotal: string;
    afterGrandTotal?: Array<{ label: string; value: string }>;
    footer?: string;
  },
) {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(18).text(title, { align: "center" });
    doc.moveDown(0.8);
    doc.fontSize(10);
    metadata.forEach((row) => {
      doc.text(`${row.label}: ${row.value}`);
    });
    doc.moveDown(0.8);
    doc.text("Item | Qty | Unit | Rate | Tax | Line total");
    doc.moveDown(0.4);
    lines.forEach((line) => {
      doc.text(
        `${line.itemLabel} | ${line.quantity} | ${line.unitLabel} | ${line.rate} | ${line.taxAmount} | ${line.lineTotal}`,
      );
    });
    doc.moveDown(0.8);
    doc.text(`Subtotal: ${summary.subtotal}`);
    doc.text(`Discount: ${summary.discount}`);
    doc.text(`Tax: ${summary.tax}`);
    doc.moveDown(0.4);
    doc.fontSize(12).text(`Grand Total: ${summary.grandTotal}`, { align: "right" });
    if (summary.afterGrandTotal?.length) {
      doc.moveDown(0.4);
      doc.fontSize(10);
      summary.afterGrandTotal.forEach((row) => {
        doc.text(`${row.label}: ${row.value}`);
      });
    }
    if (summary.footer) {
      doc.moveDown(0.8);
      doc.fontSize(9).text(summary.footer, { align: "center" });
    }
    doc.end();
  });
}

export async function printSalesInvoice(auth: AuthUser, id: string) {
  const invoice = await prisma.salesInvoice.findFirst({
    where: { id, businessId: auth.businessId },
  });
  if (!invoice) throw new HttpError(404, "Invoice not found");
  if (invoice.documentTaxMode === "NON_TAX") enforceNonTaxPermission(auth, "print");
  const lines = await prisma.salesInvoiceLine.findMany({ where: { salesInvoiceId: invoice.id } });
  const [business, customer, cashier, settings] = await Promise.all([
    prisma.business.findUnique({ where: { id: auth.businessId } }),
    prisma.customer.findFirst({ where: { id: invoice.customerId, businessId: auth.businessId } }),
    prisma.user.findFirst({ where: { id: invoice.createdBy, businessId: auth.businessId } }),
    prisma.businessSettings.findUnique({ where: { id: `${auth.businessId}-settings` } }),
  ]);
  const footer = templateFooterText(
    invoice.documentTaxMode === "NON_TAX" ? settings?.nonTaxTemplate : settings?.invoiceTemplate,
  );
  const unitRows = await prisma.unit.findMany({
    where: { businessId: auth.businessId, id: { in: [...new Set(lines.map((line) => line.unitId))] } },
    select: { id: true, symbol: true },
  });
  const itemRows = await prisma.item.findMany({
    where: { businessId: auth.businessId, id: { in: [...new Set(lines.map((line) => line.itemId))] } },
    select: { id: true, name: true },
  });
  const unitMap = new Map(unitRows.map((unit) => [unit.id, unit.symbol]));
  const itemMap = new Map(itemRows.map((item) => [item.id, item.name]));
  return `
    <html><body style="font-family:Arial,sans-serif;max-width:900px;margin:0 auto;">
      <h2>${escapeHtml(business?.name ?? "Business")} - ${invoice.documentTaxMode === "TAX" ? "Tax Invoice" : "Non-Tax Invoice"}</h2>
      <p><strong>Document:</strong> ${escapeHtml(invoice.invoiceNo)} | <strong>Date:</strong> ${escapeHtml(formatDate(invoice.invoiceDate))}</p>
      <p><strong>Customer:</strong> ${escapeHtml(customer?.name ?? invoice.customerId)} | <strong>Served by:</strong> ${escapeHtml(cashier?.fullName ?? invoice.createdBy)}</p>
      <table border="1" cellspacing="0" cellpadding="6" style="width:100%;border-collapse:collapse;">
        <thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Rate</th><th>Total</th></tr></thead>
        <tbody>
          ${lines
            .map((line) => {
              const itemName = itemMap.get(line.itemId) ?? line.itemId;
              const unit = unitMap.get(line.unitId) ?? line.unitId;
              return `<tr><td>${escapeHtml(itemName)}</td><td>${escapeHtml(line.enteredQuantity)}</td><td>${escapeHtml(unit)}</td><td>${escapeHtml(line.unitPrice)}</td><td>${escapeHtml(line.lineTotal)}</td></tr>`;
            })
            .join("")}
        </tbody>
      </table>
      <p><strong>Subtotal:</strong> ${escapeHtml(invoice.subtotal)} | <strong>Discount:</strong> ${escapeHtml(invoice.discountAmount)} | <strong>Tax:</strong> ${escapeHtml(invoice.taxAmount)}</p>
      <p><strong>Grand Total:</strong> ${escapeHtml(invoice.grandTotal)} | <strong>Received:</strong> ${escapeHtml(invoice.amountReceived)} | <strong>Balance/Change:</strong> ${escapeHtml(invoice.balanceDue)}</p>
      <p>${escapeHtml(footer)}</p>
    </body></html>
  `;
}

export async function generateThermalReceipt(auth: AuthUser, id: string) {
  const invoice = await prisma.salesInvoice.findFirst({
    where: { id, businessId: auth.businessId },
  });
  if (!invoice) throw new HttpError(404, "Invoice not found");
  if (invoice.documentTaxMode === "NON_TAX") enforceNonTaxPermission(auth, "print");
  const lines = await prisma.salesInvoiceLine.findMany({ where: { salesInvoiceId: invoice.id } });
  const [business, customer, cashier, settings] = await Promise.all([
    prisma.business.findUnique({ where: { id: auth.businessId } }),
    prisma.customer.findFirst({ where: { id: invoice.customerId, businessId: auth.businessId } }),
    prisma.user.findFirst({ where: { id: invoice.createdBy, businessId: auth.businessId } }),
    prisma.businessSettings.findUnique({ where: { id: `${auth.businessId}-settings` } }),
  ]);
  const footer = templateFooterText(
    invoice.documentTaxMode === "NON_TAX" ? settings?.nonTaxTemplate : settings?.invoiceTemplate,
  );
  const unitRows = await prisma.unit.findMany({
    where: { businessId: auth.businessId, id: { in: [...new Set(lines.map((line) => line.unitId))] } },
    select: { id: true, symbol: true },
  });
  const itemRows = await prisma.item.findMany({
    where: { businessId: auth.businessId, id: { in: [...new Set(lines.map((line) => line.itemId))] } },
    select: { id: true, name: true },
  });
  const unitMap = new Map(unitRows.map((unit) => [unit.id, unit.symbol]));
  const itemMap = new Map(itemRows.map((item) => [item.id, item.name]));
  return `
    <html><body style="width:280px;font-family:Arial,sans-serif;">
      <h3 style="margin:0 0 8px;">${escapeHtml(business?.name ?? "Business")}</h3>
      <div><strong>${invoice.documentTaxMode === "TAX" ? "Tax" : "Non-Tax"} Receipt</strong></div>
      <div>Invoice: ${escapeHtml(invoice.invoiceNo)}</div>
      <div>Date: ${escapeHtml(formatDate(invoice.invoiceDate))}</div>
      <div>Customer: ${escapeHtml(customer?.name ?? invoice.customerId)}</div>
      <div>Served by: ${escapeHtml(cashier?.fullName ?? invoice.createdBy)}</div>
      <hr />
      ${lines
        .map(
          (line) => `
        <div style="display:flex;justify-content:space-between;">
          <span>${escapeHtml(itemMap.get(line.itemId) ?? line.itemId)} x ${escapeHtml(line.enteredQuantity)} ${escapeHtml(unitMap.get(line.unitId) ?? "")}</span>
          <span>${escapeHtml(line.lineTotal)}</span>
        </div>`,
        )
        .join("")}
      <hr />
      <div style="display:flex;justify-content:space-between;"><span>Subtotal</span><span>${escapeHtml(invoice.subtotal)}</span></div>
      <div style="display:flex;justify-content:space-between;"><span>Discount</span><span>${escapeHtml(invoice.discountAmount)}</span></div>
      <div style="display:flex;justify-content:space-between;"><span>Tax</span><span>${escapeHtml(invoice.taxAmount)}</span></div>
      <div style="display:flex;justify-content:space-between;font-weight:bold;">
        <span>TOTAL</span><span>${escapeHtml(invoice.grandTotal)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;"><span>Received</span><span>${escapeHtml(invoice.amountReceived)}</span></div>
      <div style="display:flex;justify-content:space-between;"><span>Balance/Change</span><span>${escapeHtml(invoice.balanceDue)}</span></div>
      <hr />
      <div style="font-size:11px;text-align:center;">${escapeHtml(footer)}</div>
    </body></html>
  `;
}

export async function generateInvoicePdfHtml(auth: AuthUser, id: string, mode: "TAX" | "NON_TAX") {
  const invoice = await prisma.salesInvoice.findFirst({
    where: { id, businessId: auth.businessId, documentTaxMode: mode },
  });
  if (!invoice) throw new HttpError(404, "Invoice not found for selected mode");
  if (mode === "NON_TAX") enforceNonTaxPermission(auth, "print");
  const lines = await prisma.salesInvoiceLine.findMany({ where: { salesInvoiceId: invoice.id } });
  const [business, customer, cashier, settings] = await Promise.all([
    prisma.business.findUnique({ where: { id: auth.businessId } }),
    prisma.customer.findFirst({ where: { id: invoice.customerId, businessId: auth.businessId } }),
    prisma.user.findFirst({ where: { id: invoice.createdBy, businessId: auth.businessId } }),
    prisma.businessSettings.findUnique({ where: { id: `${auth.businessId}-settings` } }),
  ]);
  const footer = templateFooterText(mode === "NON_TAX" ? settings?.nonTaxTemplate : settings?.invoiceTemplate);
  const unitRows = await prisma.unit.findMany({
    where: { businessId: auth.businessId, id: { in: [...new Set(lines.map((line) => line.unitId))] } },
    select: { id: true, symbol: true },
  });
  const itemRows = await prisma.item.findMany({
    where: { businessId: auth.businessId, id: { in: [...new Set(lines.map((line) => line.itemId))] } },
    select: { id: true, name: true },
  });
  const unitMap = new Map(unitRows.map((unit) => [unit.id, unit.symbol]));
  const itemMap = new Map(itemRows.map((item) => [item.id, item.name]));
  return `
    <html><body style="font-family:Arial,sans-serif;">
      <h1>${escapeHtml(business?.name ?? "Business")} - ${mode === "TAX" ? "TAX INVOICE (A4)" : "NON-TAX INVOICE (A4)"}</h1>
      <p>Invoice: ${escapeHtml(invoice.invoiceNo)}</p>
      <p>Date: ${escapeHtml(formatDate(invoice.invoiceDate))}</p>
      <p>Customer: ${escapeHtml(customer?.name ?? invoice.customerId)}</p>
      <p>Served by: ${escapeHtml(cashier?.fullName ?? invoice.createdBy)}</p>
      <table border="1" cellspacing="0" cellpadding="6" style="width:100%;border-collapse:collapse;">
        <thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Rate</th><th>Tax</th><th>Total</th></tr></thead>
        <tbody>
          ${lines
            .map(
              (line) =>
                `<tr><td>${escapeHtml(itemMap.get(line.itemId) ?? line.itemId)}</td><td>${escapeHtml(line.enteredQuantity)}</td><td>${escapeHtml(unitMap.get(line.unitId) ?? line.unitId)}</td><td>${escapeHtml(line.unitPrice)}</td><td>${escapeHtml(line.taxAmount)}</td><td>${escapeHtml(line.lineTotal)}</td></tr>`,
            )
            .join("")}
        </tbody>
      </table>
      <p><strong>Subtotal:</strong> ${escapeHtml(invoice.subtotal)} | <strong>Discount:</strong> ${escapeHtml(invoice.discountAmount)} | <strong>Tax:</strong> ${escapeHtml(invoice.taxAmount)}</p>
      <h3 style="text-align:right;">Grand Total: ${escapeHtml(invoice.grandTotal)}</h3>
      <p style="text-align:right;">Received: ${escapeHtml(invoice.amountReceived)} | Balance/Change: ${escapeHtml(invoice.balanceDue)}</p>
      <p style="margin-top:16px;">${escapeHtml(footer)}</p>
    </body></html>
  `;
}

export async function generateInvoicePdf(auth: AuthUser, id: string, mode: "TAX" | "NON_TAX") {
  const invoice = await prisma.salesInvoice.findFirst({
    where: { id, businessId: auth.businessId, documentTaxMode: mode },
  });
  if (!invoice) throw new HttpError(404, "Invoice not found for selected mode");
  if (mode === "NON_TAX") enforceNonTaxPermission(auth, "print");
  const lines = await prisma.salesInvoiceLine.findMany({ where: { salesInvoiceId: invoice.id } });
  const [business, customer, cashier, settings, { itemMap, unitMap }] = await Promise.all([
    prisma.business.findUnique({ where: { id: auth.businessId } }),
    prisma.customer.findFirst({ where: { id: invoice.customerId, businessId: auth.businessId } }),
    prisma.user.findFirst({ where: { id: invoice.createdBy, businessId: auth.businessId } }),
    prisma.businessSettings.findUnique({ where: { id: `${auth.businessId}-settings` } }),
    loadItemUnitMaps(
      auth.businessId,
      lines.map((l) => l.itemId),
      lines.map((l) => l.unitId),
    ),
  ]);
  const footer = templateFooterText(mode === "NON_TAX" ? settings?.nonTaxTemplate : settings?.invoiceTemplate);
  return buildPdfBuffer(
    mode === "TAX" ? "Tax Invoice (A4)" : "Non-Tax Invoice (A4)",
    [
      { label: "Business", value: business?.name ?? "" },
      { label: "Invoice", value: invoice.invoiceNo },
      { label: "Mode", value: invoice.documentTaxMode },
      { label: "Date", value: formatDate(invoice.invoiceDate) },
      { label: "Customer", value: customer?.name ?? invoice.customerId },
      { label: "Served by", value: cashier?.fullName ?? invoice.createdBy },
    ],
    lines.map((line) => ({
      itemLabel: itemMap.get(line.itemId) ?? line.itemId,
      quantity: String(line.enteredQuantity),
      unitLabel: unitMap.get(line.unitId) ?? line.unitId,
      rate: String(line.unitPrice),
      taxAmount: String(line.taxAmount),
      lineTotal: String(line.lineTotal),
    })),
    {
      subtotal: String(invoice.subtotal),
      discount: String(invoice.discountAmount),
      tax: String(invoice.taxAmount),
      grandTotal: String(invoice.grandTotal),
      afterGrandTotal: [
        { label: "Received", value: String(invoice.amountReceived) },
        { label: "Balance/Change", value: String(invoice.balanceDue) },
      ],
      footer,
    },
  );
}

export async function printSalesReturn(auth: AuthUser, id: string) {
  const salesReturn = await prisma.salesReturn.findFirst({
    where: { id, businessId: auth.businessId },
  });
  if (!salesReturn) throw new HttpError(404, "Sales return not found");
  const lines = await prisma.salesReturnLine.findMany({
    where: { salesReturnId: salesReturn.id },
  });
  const [business, customer, cashier, sourceInvoice, settings, { itemMap, unitMap }] = await Promise.all([
    prisma.business.findUnique({ where: { id: auth.businessId } }),
    prisma.customer.findFirst({ where: { id: salesReturn.customerId, businessId: auth.businessId } }),
    prisma.user.findFirst({ where: { id: salesReturn.createdBy, businessId: auth.businessId } }),
    prisma.salesInvoice.findFirst({
      where: { id: salesReturn.sourceInvoiceId, businessId: auth.businessId },
      select: { invoiceNo: true },
    }),
    prisma.businessSettings.findUnique({ where: { id: `${auth.businessId}-settings` } }),
    loadItemUnitMaps(
      auth.businessId,
      lines.map((l) => l.itemId),
      lines.map((l) => l.unitId),
    ),
  ]);
  const footer = templateFooterText(settings?.invoiceTemplate, "Thank you.");
  return `
    <html><body style="font-family:Arial,sans-serif;max-width:900px;margin:0 auto;">
      <h2>${escapeHtml(business?.name ?? "Business")} - Sales Return</h2>
      <p><strong>Return:</strong> ${escapeHtml(salesReturn.salesReturnNo)} | <strong>Date:</strong> ${escapeHtml(formatDate(salesReturn.returnDate))}</p>
      <p><strong>Source invoice:</strong> ${escapeHtml(sourceInvoice?.invoiceNo ?? salesReturn.sourceInvoiceId)}</p>
      <p><strong>Customer:</strong> ${escapeHtml(customer?.name ?? salesReturn.customerId)} | <strong>Handled by:</strong> ${escapeHtml(cashier?.fullName ?? salesReturn.createdBy)}</p>
      <p><strong>Method:</strong> ${escapeHtml(salesReturn.returnMethod)} | <strong>Cash refund:</strong> ${escapeHtml(salesReturn.cashRefundAmount)} | <strong>Exchange adj.:</strong> ${escapeHtml(salesReturn.exchangeAdjustmentAmount)}</p>
      <table border="1" cellspacing="0" cellpadding="6" style="width:100%;border-collapse:collapse;">
        <thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Rate</th><th>Tax</th><th>Total</th><th>Reason</th></tr></thead>
        <tbody>
          ${lines
            .map((line) => {
              const itemName = itemMap.get(line.itemId) ?? line.itemId;
              const unit = unitMap.get(line.unitId) ?? line.unitId;
              return `<tr><td>${escapeHtml(itemName)}</td><td>${escapeHtml(line.enteredQuantity)}</td><td>${escapeHtml(unit)}</td><td>${escapeHtml(line.unitPrice)}</td><td>${escapeHtml(line.taxAmount)}</td><td>${escapeHtml(line.lineTotal)}</td><td>${escapeHtml(line.reason ?? "—")}</td></tr>`;
            })
            .join("")}
        </tbody>
      </table>
      <p><strong>Subtotal:</strong> ${escapeHtml(salesReturn.subtotal)} | <strong>Discount:</strong> ${escapeHtml(salesReturn.discountAmount)} | <strong>Tax:</strong> ${escapeHtml(salesReturn.taxAmount)}</p>
      <p><strong>Grand Total:</strong> ${escapeHtml(salesReturn.grandTotal)}</p>
      <p>${escapeHtml(footer)}</p>
    </body></html>
  `;
}

export async function generateSalesReturnPdf(auth: AuthUser, id: string) {
  const salesReturn = await prisma.salesReturn.findFirst({
    where: { id, businessId: auth.businessId },
  });
  if (!salesReturn) throw new HttpError(404, "Sales return not found");
  const lines = await prisma.salesReturnLine.findMany({
    where: { salesReturnId: salesReturn.id },
  });
  const [business, customer, cashier, sourceInvoice, settings, { itemMap, unitMap }] = await Promise.all([
    prisma.business.findUnique({ where: { id: auth.businessId } }),
    prisma.customer.findFirst({ where: { id: salesReturn.customerId, businessId: auth.businessId } }),
    prisma.user.findFirst({ where: { id: salesReturn.createdBy, businessId: auth.businessId } }),
    prisma.salesInvoice.findFirst({
      where: { id: salesReturn.sourceInvoiceId, businessId: auth.businessId },
      select: { invoiceNo: true },
    }),
    prisma.businessSettings.findUnique({ where: { id: `${auth.businessId}-settings` } }),
    loadItemUnitMaps(
      auth.businessId,
      lines.map((l) => l.itemId),
      lines.map((l) => l.unitId),
    ),
  ]);
  const footer = templateFooterText(settings?.invoiceTemplate, "Thank you.");
  return buildPdfBuffer(
    "Sales Return (A4)",
    [
      { label: "Business", value: business?.name ?? "" },
      { label: "Return", value: salesReturn.salesReturnNo },
      { label: "Date", value: formatDate(salesReturn.returnDate) },
      { label: "Source invoice", value: sourceInvoice?.invoiceNo ?? salesReturn.sourceInvoiceId },
      { label: "Customer", value: customer?.name ?? salesReturn.customerId },
      { label: "Handled by", value: cashier?.fullName ?? salesReturn.createdBy },
    ],
    lines.map((line) => {
      const baseName = itemMap.get(line.itemId) ?? line.itemId;
      const itemLabel = line.reason ? `${baseName} (${line.reason})` : baseName;
      return {
        itemLabel,
        quantity: String(line.enteredQuantity),
        unitLabel: unitMap.get(line.unitId) ?? line.unitId,
        rate: String(line.unitPrice),
        taxAmount: String(line.taxAmount),
        lineTotal: String(line.lineTotal),
      };
    }),
    {
      subtotal: String(salesReturn.subtotal),
      discount: String(salesReturn.discountAmount),
      tax: String(salesReturn.taxAmount),
      grandTotal: String(salesReturn.grandTotal),
      afterGrandTotal: [
        { label: "Return method", value: String(salesReturn.returnMethod) },
        { label: "Cash refund", value: String(salesReturn.cashRefundAmount) },
        { label: "Exchange adjustment", value: String(salesReturn.exchangeAdjustmentAmount) },
      ],
      footer,
    },
  );
}

export async function printQuotation(auth: AuthUser, id: string) {
  const quotation = await prisma.quotation.findFirst({
    where: { id, businessId: auth.businessId },
  });
  if (!quotation) throw new HttpError(404, "Quotation not found");
  const lines = await prisma.quotationLine.findMany({ where: { quotationId: quotation.id } });
  const [business, customer, author, settings, { itemMap, unitMap }] = await Promise.all([
    prisma.business.findUnique({ where: { id: auth.businessId } }),
    prisma.customer.findFirst({ where: { id: quotation.customerId, businessId: auth.businessId } }),
    prisma.user.findFirst({ where: { id: quotation.createdBy, businessId: auth.businessId } }),
    prisma.businessSettings.findUnique({ where: { id: `${auth.businessId}-settings` } }),
    loadItemUnitMaps(
      auth.businessId,
      lines.map((l) => l.itemId),
      lines.map((l) => l.unitId),
    ),
  ]);
  const footer = templateFooterText(settings?.invoiceTemplate);
  return `
    <html><body style="font-family:Arial,sans-serif;max-width:900px;margin:0 auto;">
      <h2>${escapeHtml(business?.name ?? "Business")} - Quotation</h2>
      <p><strong>Quotation:</strong> ${escapeHtml(quotation.quotationNo)} | <strong>Date:</strong> ${escapeHtml(formatDate(quotation.quotationDate))}</p>
      <p><strong>Customer:</strong> ${escapeHtml(customer?.name ?? quotation.customerId)} | <strong>Prepared by:</strong> ${escapeHtml(author?.fullName ?? quotation.createdBy)}</p>
      <table border="1" cellspacing="0" cellpadding="6" style="width:100%;border-collapse:collapse;">
        <thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Rate</th><th>Tax</th><th>Total</th></tr></thead>
        <tbody>
          ${lines
            .map((line) => {
              const itemName = itemMap.get(line.itemId) ?? line.itemId;
              const unit = unitMap.get(line.unitId) ?? line.unitId;
              return `<tr><td>${escapeHtml(itemName)}</td><td>${escapeHtml(line.enteredQuantity)}</td><td>${escapeHtml(unit)}</td><td>${escapeHtml(line.unitPrice)}</td><td>${escapeHtml(line.taxAmount)}</td><td>${escapeHtml(line.lineTotal)}</td></tr>`;
            })
            .join("")}
        </tbody>
      </table>
      <p><strong>Subtotal:</strong> ${escapeHtml(quotation.subtotal)} | <strong>Discount:</strong> ${escapeHtml(quotation.discountAmount)} | <strong>Tax:</strong> ${escapeHtml(quotation.taxAmount)}</p>
      <p><strong>Grand Total:</strong> ${escapeHtml(quotation.grandTotal)}</p>
      <p>${escapeHtml(footer)}</p>
    </body></html>
  `;
}

export async function generateQuotationPdf(auth: AuthUser, id: string) {
  const quotation = await prisma.quotation.findFirst({
    where: { id, businessId: auth.businessId },
  });
  if (!quotation) throw new HttpError(404, "Quotation not found");
  const lines = await prisma.quotationLine.findMany({ where: { quotationId: quotation.id } });
  const [business, customer, author, settings, { itemMap, unitMap }] = await Promise.all([
    prisma.business.findUnique({ where: { id: auth.businessId } }),
    prisma.customer.findFirst({ where: { id: quotation.customerId, businessId: auth.businessId } }),
    prisma.user.findFirst({ where: { id: quotation.createdBy, businessId: auth.businessId } }),
    prisma.businessSettings.findUnique({ where: { id: `${auth.businessId}-settings` } }),
    loadItemUnitMaps(
      auth.businessId,
      lines.map((l) => l.itemId),
      lines.map((l) => l.unitId),
    ),
  ]);
  const footer = templateFooterText(settings?.invoiceTemplate);
  return buildPdfBuffer(
    "Quotation (A4)",
    [
      { label: "Business", value: business?.name ?? "" },
      { label: "Quotation", value: quotation.quotationNo },
      { label: "Date", value: formatDate(quotation.quotationDate) },
      { label: "Customer", value: customer?.name ?? quotation.customerId },
      { label: "Prepared by", value: author?.fullName ?? quotation.createdBy },
    ],
    lines.map((line) => ({
      itemLabel: itemMap.get(line.itemId) ?? line.itemId,
      quantity: String(line.enteredQuantity),
      unitLabel: unitMap.get(line.unitId) ?? line.unitId,
      rate: String(line.unitPrice),
      taxAmount: String(line.taxAmount),
      lineTotal: String(line.lineTotal),
    })),
    {
      subtotal: String(quotation.subtotal),
      discount: String(quotation.discountAmount),
      tax: String(quotation.taxAmount),
      grandTotal: String(quotation.grandTotal),
      footer,
    },
  );
}

export async function printPurchase(auth: AuthUser, id: string) {
  const purchase = await prisma.purchase.findFirst({
    where: { id, businessId: auth.businessId },
  });
  if (!purchase) throw new HttpError(404, "Purchase not found");
  const lines = await prisma.purchaseLine.findMany({ where: { purchaseId: purchase.id } });
  const [business, supplier, author, settings, { itemMap, unitMap }] = await Promise.all([
    prisma.business.findUnique({ where: { id: auth.businessId } }),
    prisma.supplier.findFirst({ where: { id: purchase.supplierId, businessId: auth.businessId } }),
    prisma.user.findFirst({ where: { id: purchase.createdBy, businessId: auth.businessId } }),
    prisma.businessSettings.findUnique({ where: { id: `${auth.businessId}-settings` } }),
    loadItemUnitMaps(
      auth.businessId,
      lines.map((l) => l.itemId),
      lines.map((l) => l.unitId),
    ),
  ]);
  const footer = templateFooterText(settings?.invoiceTemplate, "Thank you.");
  return `
    <html><body style="font-family:Arial,sans-serif;max-width:900px;margin:0 auto;">
      <h2>${escapeHtml(business?.name ?? "Business")} - Purchase</h2>
      <p><strong>Purchase:</strong> ${escapeHtml(purchase.purchaseNo)} | <strong>Date:</strong> ${escapeHtml(formatDate(purchase.purchaseDate))}</p>
      <p><strong>Supplier:</strong> ${escapeHtml(supplier?.name ?? purchase.supplierId)} | <strong>Recorded by:</strong> ${escapeHtml(author?.fullName ?? purchase.createdBy)}</p>
      <table border="1" cellspacing="0" cellpadding="6" style="width:100%;border-collapse:collapse;">
        <thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Cost</th><th>Tax</th><th>Total</th></tr></thead>
        <tbody>
          ${lines
            .map((line) => {
              const itemName = itemMap.get(line.itemId) ?? line.itemId;
              const unit = unitMap.get(line.unitId) ?? line.unitId;
              return `<tr><td>${escapeHtml(itemName)}</td><td>${escapeHtml(line.enteredQuantity)}</td><td>${escapeHtml(unit)}</td><td>${escapeHtml(line.unitCost)}</td><td>${escapeHtml(line.taxAmount)}</td><td>${escapeHtml(line.lineTotal)}</td></tr>`;
            })
            .join("")}
        </tbody>
      </table>
      <p><strong>Subtotal:</strong> ${escapeHtml(purchase.subtotal)} | <strong>Discount:</strong> ${escapeHtml(purchase.discountAmount)} | <strong>Tax:</strong> ${escapeHtml(purchase.taxAmount)}</p>
      <p><strong>Grand Total:</strong> ${escapeHtml(purchase.grandTotal)} | <strong>Paid:</strong> ${escapeHtml(purchase.amountPaid)} | <strong>Balance payable:</strong> ${escapeHtml(purchase.balancePayable)}</p>
      <p>${escapeHtml(footer)}</p>
    </body></html>
  `;
}

export async function generatePurchasePdf(auth: AuthUser, id: string) {
  const purchase = await prisma.purchase.findFirst({
    where: { id, businessId: auth.businessId },
  });
  if (!purchase) throw new HttpError(404, "Purchase not found");
  const lines = await prisma.purchaseLine.findMany({ where: { purchaseId: purchase.id } });
  const [business, supplier, author, settings, { itemMap, unitMap }] = await Promise.all([
    prisma.business.findUnique({ where: { id: auth.businessId } }),
    prisma.supplier.findFirst({ where: { id: purchase.supplierId, businessId: auth.businessId } }),
    prisma.user.findFirst({ where: { id: purchase.createdBy, businessId: auth.businessId } }),
    prisma.businessSettings.findUnique({ where: { id: `${auth.businessId}-settings` } }),
    loadItemUnitMaps(
      auth.businessId,
      lines.map((l) => l.itemId),
      lines.map((l) => l.unitId),
    ),
  ]);
  const footer = templateFooterText(settings?.invoiceTemplate, "Thank you.");
  return buildPdfBuffer(
    "Purchase (A4)",
    [
      { label: "Business", value: business?.name ?? "" },
      { label: "Purchase", value: purchase.purchaseNo },
      { label: "Date", value: formatDate(purchase.purchaseDate) },
      { label: "Supplier", value: supplier?.name ?? purchase.supplierId },
      { label: "Recorded by", value: author?.fullName ?? purchase.createdBy },
    ],
    lines.map((line) => ({
      itemLabel: itemMap.get(line.itemId) ?? line.itemId,
      quantity: String(line.enteredQuantity),
      unitLabel: unitMap.get(line.unitId) ?? line.unitId,
      rate: String(line.unitCost),
      taxAmount: String(line.taxAmount),
      lineTotal: String(line.lineTotal),
    })),
    {
      subtotal: String(purchase.subtotal),
      discount: String(purchase.discountAmount),
      tax: String(purchase.taxAmount),
      grandTotal: String(purchase.grandTotal),
      afterGrandTotal: [
        { label: "Amount paid", value: String(purchase.amountPaid) },
        { label: "Balance payable", value: String(purchase.balancePayable) },
      ],
      footer,
    },
  );
}

export async function reprintSearch(auth: AuthUser, query: unknown) {
  const input = reprintSearchQuerySchema.parse(query);
  const skip = (input.page - 1) * input.pageSize;
  const take = input.pageSize;
  const canViewNonTax = hasPermission(auth, "sales.non_tax.view");

  const conditions: Prisma.SalesInvoiceWhereInput[] = [{ businessId: auth.businessId }];

  if (!canViewNonTax) {
    conditions.push({ documentTaxMode: "TAX" });
  }
  if (input.customerId) {
    conditions.push({ customerId: input.customerId });
  }
  if (input.customerName) {
    const matchingCustomers = await prisma.customer.findMany({
      where: {
        businessId: auth.businessId,
        name: { contains: input.customerName, mode: "insensitive" },
      },
      select: { id: true },
    });
    const customerIds = matchingCustomers.map((row) => row.id);
    if (customerIds.length === 0) {
      return [];
    }
    conditions.push({ customerId: { in: customerIds } });
  }
  if (input.invoiceNo) {
    conditions.push({ invoiceNo: { contains: input.invoiceNo, mode: "insensitive" } });
  }
  if (input.dateFrom || input.dateTo) {
    conditions.push({
      invoiceDate: {
        ...(input.dateFrom ? { gte: parseQueryDateStart(input.dateFrom) } : {}),
        ...(input.dateTo ? { lte: parseQueryDateEnd(input.dateTo) } : {}),
      },
    });
  }
  if (input.grandTotalMin !== undefined || input.grandTotalMax !== undefined) {
    conditions.push({
      grandTotal: {
        ...(input.grandTotalMin !== undefined ? { gte: input.grandTotalMin } : {}),
        ...(input.grandTotalMax !== undefined ? { lte: input.grandTotalMax } : {}),
      },
    });
  }
  if (input.itemId) {
    const lineRows = await prisma.salesInvoiceLine.findMany({
      where: { itemId: input.itemId },
      select: { salesInvoiceId: true },
    });
    const invoiceIds = [...new Set(lineRows.map((row) => row.salesInvoiceId))];
    if (invoiceIds.length === 0) {
      return [];
    }
    conditions.push({ id: { in: invoiceIds } });
  }
  if (input.itemSearch) {
    const matchingItems = await prisma.item.findMany({
      where: {
        businessId: auth.businessId,
        OR: [
          { name: { contains: input.itemSearch, mode: "insensitive" } },
          { code: { contains: input.itemSearch, mode: "insensitive" } },
          { sku: { contains: input.itemSearch, mode: "insensitive" } },
          { barcode: { contains: input.itemSearch, mode: "insensitive" } },
        ],
      },
      select: { id: true },
    });
    const itemIds = matchingItems.map((row) => row.id);
    if (itemIds.length === 0) {
      return [];
    }
    const lineRows = await prisma.salesInvoiceLine.findMany({
      where: { itemId: { in: itemIds } },
      select: { salesInvoiceId: true },
    });
    const invoiceIds = [...new Set(lineRows.map((row) => row.salesInvoiceId))];
    if (invoiceIds.length === 0) {
      return [];
    }
    conditions.push({ id: { in: invoiceIds } });
  }
  if (input.search) {
    conditions.push({
      OR: [
        { invoiceNo: { contains: input.search, mode: "insensitive" } },
        { customerId: { contains: input.search, mode: "insensitive" } },
      ],
    });
  }

  return prisma.salesInvoice.findMany({
    where: { AND: conditions },
    orderBy: { createdAt: "desc" },
    skip,
    take,
  });
}
