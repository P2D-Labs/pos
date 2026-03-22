import { prisma } from "../lib/prisma";
import type { AuthUser } from "../middleware/auth";
import { customerListQuerySchema, customerSchema, customerUpdateSchema } from "../models/customer.model";
import { HttpError } from "../lib/http";

export async function listCustomers(auth: AuthUser, query: unknown) {
  const input = customerListQuerySchema.parse(query);
  const skip = (input.page - 1) * input.pageSize;
  const take = input.pageSize;
  return prisma.customer.findMany({
    where: {
      businessId: auth.businessId,
      OR: input.search
        ? [
            { code: { contains: input.search, mode: "insensitive" } },
            { name: { contains: input.search, mode: "insensitive" } },
            { contactPerson: { contains: input.search, mode: "insensitive" } },
            { phone: { contains: input.search, mode: "insensitive" } },
            { email: { contains: input.search, mode: "insensitive" } },
            { billingAddress: { contains: input.search, mode: "insensitive" } },
            { shippingAddress: { contains: input.search, mode: "insensitive" } },
            { taxNo: { contains: input.search, mode: "insensitive" } },
          ]
        : undefined,
    },
    orderBy: { createdAt: "desc" },
    skip,
    take,
  });
}

export async function createCustomer(auth: AuthUser, payload: unknown) {
  const input = customerSchema.parse(payload);
  if (input.customerType === "WALK_IN") {
    throw new HttpError(400, "Walk-in customer is managed by the system only");
  }
  const openingBalance = input.openingBalance ?? 0;
  return prisma.customer.create({
    data: {
      ...input,
      businessId: auth.businessId,
      currentBalance: openingBalance,
    },
  });
}

export async function getCustomerById(auth: AuthUser, customerId: string) {
  const data = await prisma.customer.findFirst({
    where: { id: customerId, businessId: auth.businessId },
  });
  if (!data) throw new HttpError(404, "Customer not found");
  return data;
}

export async function updateCustomer(auth: AuthUser, customerId: string, payload: unknown) {
  const input = customerUpdateSchema.parse(payload);
  const existing = await prisma.customer.findFirst({ where: { id: customerId, businessId: auth.businessId } });
  if (!existing) throw new HttpError(404, "Customer not found");
  if (existing.customerType === "WALK_IN") {
    throw new HttpError(400, "The walk-in customer record cannot be modified");
  }
  return prisma.customer.update({
    where: { id: customerId },
    data: {
      ...input,
      ...(input.openingBalance !== undefined ? { currentBalance: input.openingBalance } : {}),
    },
  });
}

/** POS: pending orders + store credit for a customer */
export async function getCustomerCheckoutContext(auth: AuthUser, customerId: string) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, businessId: auth.businessId },
    select: {
      id: true,
      name: true,
      customerType: true,
      storeCreditBalance: true,
      currentBalance: true,
    },
  });
  if (!customer) throw new HttpError(404, "Customer not found");

  const pendingOrders = await prisma.salesOrder.findMany({
    where: {
      businessId: auth.businessId,
      customerId,
      balanceDue: { gt: 0 },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      orderNo: true,
      orderDate: true,
      grandTotal: true,
      amountPaid: true,
      balanceDue: true,
      documentTaxMode: true,
    },
  });

  const recentReturns = await prisma.salesReturn.findMany({
    where: { businessId: auth.businessId, customerId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      salesReturnNo: true,
      grandTotal: true,
      createdAt: true,
      sourceInvoiceId: true,
    },
  });

  return {
    customerType: customer.customerType,
    storeCreditBalance: Number(customer.storeCreditBalance ?? 0),
    accountsReceivable: Number(customer.currentBalance ?? 0),
    pendingOrders: pendingOrders.map((o) => ({
      id: o.id,
      orderNo: o.orderNo,
      orderDate: o.orderDate,
      grandTotal: Number(o.grandTotal),
      amountPaid: Number(o.amountPaid),
      balanceDue: Number(o.balanceDue),
      documentTaxMode: o.documentTaxMode,
    })),
    recentReturns: recentReturns.map((r) => ({
      id: r.id,
      salesReturnNo: r.salesReturnNo,
      grandTotal: Number(r.grandTotal),
      createdAt: r.createdAt.toISOString(),
      sourceInvoiceId: r.sourceInvoiceId,
    })),
  };
}
