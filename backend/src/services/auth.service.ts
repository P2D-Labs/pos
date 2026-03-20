import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { env } from "../config/env";
import { HttpError } from "../lib/http";
import { prisma } from "../lib/prisma";
import type {
  BusinessSetupInput,
  ForgotPasswordInput,
  LoginInput,
  RefreshInput,
  ResetPasswordInput,
} from "../models/auth.model";
import { listQuerySchema } from "../models/common.model";

export async function setupBusiness(input: BusinessSetupInput) {
  const existing = await prisma.business.count();
  if (existing > 0) throw new HttpError(400, "Setup already completed");

  const business = await prisma.business.create({
    data: { name: input.businessName, ownerName: input.ownerName },
  });

  const role = await prisma.role.create({
    data: { businessId: business.id, name: "Super Admin", permissions: ["*"] },
  });

  const passwordHash = await bcrypt.hash(input.adminPassword, 10);
  const user = await prisma.user.create({
    data: {
      businessId: business.id,
      fullName: input.adminName,
      email: input.adminEmail,
      passwordHash,
      roleId: role.id,
    },
  });

  await prisma.customer.create({
    data: { businessId: business.id, name: "Walk-in Customer", customerType: "WALK_IN" },
  });

  return { businessId: business.id, userId: user.id };
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    include: { role: true },
  });
  if (!user || !user.isActive) throw new HttpError(401, "Invalid credentials");

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) throw new HttpError(401, "Invalid credentials");

  const tokenId = crypto.randomUUID();
  const payload = {
    sub: user.id,
    businessId: user.businessId,
    roleId: user.roleId,
    permissions: user.role.permissions,
    tokenId,
  };

  const accessToken = jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: "15m" });
  const refreshToken = jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: "7d" });
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      businessId: user.businessId,
      tokenId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
  return { accessToken, refreshToken };
}

export async function refresh(input: RefreshInput) {
  let decoded: {
    sub: string;
    businessId: string;
    roleId: string;
    permissions: string[];
    tokenId: string;
  };
  try {
    decoded = jwt.verify(input.refreshToken, env.JWT_REFRESH_SECRET) as typeof decoded;
  } catch {
    throw new HttpError(401, "Invalid refresh token");
  }

  const tokenRow = await prisma.refreshToken.findUnique({
    where: { tokenId: decoded.tokenId },
    include: { user: { include: { role: true } } },
  });
  if (!tokenRow || tokenRow.isRevoked || tokenRow.expiresAt < new Date()) {
    throw new HttpError(401, "Refresh token revoked or expired");
  }

  await prisma.refreshToken.update({
    where: { tokenId: tokenRow.tokenId },
    data: { isRevoked: true },
  });

  const newTokenId = crypto.randomUUID();
  const payload = {
    sub: tokenRow.user.id,
    businessId: tokenRow.user.businessId,
    roleId: tokenRow.user.roleId,
    permissions: tokenRow.user.role.permissions,
    tokenId: newTokenId,
  };

  const accessToken = jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: "15m" });
  const refreshToken = jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: "7d" });
  await prisma.refreshToken.create({
    data: {
      userId: tokenRow.user.id,
      businessId: tokenRow.user.businessId,
      tokenId: newTokenId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
  return { accessToken, refreshToken };
}

export async function logout(input: RefreshInput) {
  try {
    const decoded = jwt.verify(input.refreshToken, env.JWT_REFRESH_SECRET) as { tokenId: string };
    await prisma.refreshToken.updateMany({
      where: { tokenId: decoded.tokenId },
      data: { isRevoked: true },
    });
  } catch {
    // keep logout idempotent
  }
  return { success: true };
}

export async function logoutAll(userId: string) {
  await prisma.refreshToken.updateMany({
    where: { userId, isRevoked: false },
    data: { isRevoked: true },
  });
  return { success: true };
}

export async function listSessions(userId: string, query: unknown) {
  const list = listQuerySchema.parse(query);
  const skip = (list.page - 1) * list.pageSize;
  const take = list.pageSize;
  return prisma.refreshToken.findMany({
    where: {
      userId,
      isRevoked: false,
      expiresAt: { gt: new Date() },
      tokenId: list.search ? { contains: list.search, mode: "insensitive" } : undefined,
    },
    orderBy: { createdAt: "desc" },
    select: { tokenId: true, createdAt: true, expiresAt: true },
    skip,
    take,
  });
}

export async function revokeSession(userId: string, tokenId: string) {
  await prisma.refreshToken.updateMany({
    where: { userId, tokenId },
    data: { isRevoked: true },
  });
  return { success: true };
}

export async function forgotPassword(input: ForgotPasswordInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) return { success: true };
  const token = crypto.randomUUID();
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    },
  });
  // In real deployment send this token via email/SMS.
  return { success: true, resetToken: token };
}

export async function resetPassword(input: ResetPasswordInput) {
  const row = await prisma.passwordResetToken.findUnique({
    where: { token: input.token },
    include: { user: true },
  });
  if (!row || row.usedAt || row.expiresAt < new Date()) {
    throw new HttpError(400, "Invalid or expired reset token");
  }
  const passwordHash = await bcrypt.hash(input.password, 10);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: row.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    }),
    prisma.refreshToken.updateMany({
      where: { userId: row.userId, isRevoked: false },
      data: { isRevoked: true },
    }),
  ]);
  return { success: true };
}
