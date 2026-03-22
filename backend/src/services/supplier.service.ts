import { prisma } from "../lib/prisma";
import type { AuthUser } from "../middleware/auth";
import { supplierListQuerySchema, supplierSchema, supplierUpdateSchema } from "../models/supplier.model";
import { HttpError } from "../lib/http";

export async function listSuppliers(auth: AuthUser, query: unknown) {
  const input = supplierListQuerySchema.parse(query);
  const skip = (input.page - 1) * input.pageSize;
  const take = input.pageSize;
  return prisma.supplier.findMany({
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
            { taxNo: { contains: input.search, mode: "insensitive" } },
          ]
        : undefined,
    },
    orderBy: { createdAt: "desc" },
    skip,
    take,
  });
}

export async function createSupplier(auth: AuthUser, payload: unknown) {
  const input = supplierSchema.parse(payload);
  const openingBalance = input.openingBalance ?? 0;
  return prisma.supplier.create({
    data: {
      ...input,
      businessId: auth.businessId,
      currentBalance: openingBalance,
    },
  });
}

export async function getSupplierById(auth: AuthUser, supplierId: string) {
  const data = await prisma.supplier.findFirst({
    where: { id: supplierId, businessId: auth.businessId },
  });
  if (!data) throw new HttpError(404, "Supplier not found");
  return data;
}

export async function updateSupplier(auth: AuthUser, supplierId: string, payload: unknown) {
  const input = supplierUpdateSchema.parse(payload);
  const existing = await prisma.supplier.findFirst({ where: { id: supplierId, businessId: auth.businessId } });
  if (!existing) throw new HttpError(404, "Supplier not found");
  return prisma.supplier.update({
    where: { id: supplierId },
    data: {
      ...input,
      ...(input.openingBalance !== undefined ? { currentBalance: input.openingBalance } : {}),
    },
  });
}
