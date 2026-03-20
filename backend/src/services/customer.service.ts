import { prisma } from "../lib/prisma";
import type { AuthUser } from "../middleware/auth";
import { customerListQuerySchema, customerSchema } from "../models/customer.model";

export async function listCustomers(auth: AuthUser, query: unknown) {
  const input = customerListQuerySchema.parse(query);
  const skip = (input.page - 1) * input.pageSize;
  const take = input.pageSize;
  return prisma.customer.findMany({
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

export async function createCustomer(auth: AuthUser, payload: unknown) {
  const input = customerSchema.parse(payload);
  return prisma.customer.create({
    data: { ...input, businessId: auth.businessId },
  });
}
