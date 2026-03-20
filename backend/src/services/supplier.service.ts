import { prisma } from "../lib/prisma";
import type { AuthUser } from "../middleware/auth";
import { supplierListQuerySchema, supplierSchema } from "../models/supplier.model";

export async function listSuppliers(auth: AuthUser, query: unknown) {
  const input = supplierListQuerySchema.parse(query);
  const skip = (input.page - 1) * input.pageSize;
  const take = input.pageSize;
  return prisma.supplier.findMany({
    where: {
      businessId: auth.businessId,
      OR: input.search
        ? [
            { name: { contains: input.search, mode: "insensitive" } },
            { phone: { contains: input.search, mode: "insensitive" } },
            { email: { contains: input.search, mode: "insensitive" } },
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
  return prisma.supplier.create({
    data: { ...input, businessId: auth.businessId },
  });
}
