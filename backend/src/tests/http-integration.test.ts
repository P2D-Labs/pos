import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import jwt from "jsonwebtoken";
import { AddressInfo } from "node:net";

process.env.JWT_ACCESS_SECRET ??= "integration-test-access-secret-123";
process.env.JWT_REFRESH_SECRET ??= "integration-test-refresh-secret-123";
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";

const { env } = require("../config/env") as typeof import("../config/env");
const { errorMiddleware } = require("../lib/http") as typeof import("../lib/http");
const { requireAuth, requirePermission } = require("../middleware/auth") as typeof import("../middleware/auth");

function makeToken(permissions: string[]) {
  return jwt.sign(
    {
      sub: "user-int-test",
      businessId: "biz-int-test",
      roleId: "role-int-test",
      permissions,
    },
    env.JWT_ACCESS_SECRET,
    { expiresIn: "5m" },
  );
}

async function startTestServer() {
  const app = express();
  app.use(express.json());

  app.get("/open", (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/secure", requireAuth, (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/secure-permission", requireAuth, requirePermission("reports.view"), (_req, res) => {
    res.json({ ok: true });
  });

  app.use(errorMiddleware);

  const server = await new Promise<import("node:http").Server>((resolve) => {
    const created = app.listen(0, () => resolve(created));
  });
  const port = (server.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}`;
  return { server, baseUrl };
}

test("integration: open route is accessible", async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const response = await fetch(`${baseUrl}/open`);
    assert.equal(response.status, 200);
    const body = (await response.json()) as { ok: boolean };
    assert.equal(body.ok, true);
  } finally {
    server.close();
  }
});

test("integration: secure route rejects missing token", async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const response = await fetch(`${baseUrl}/secure`);
    assert.equal(response.status, 401);
  } finally {
    server.close();
  }
});

test("integration: secure route accepts valid token", async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const token = makeToken(["sales.view"]);
    const response = await fetch(`${baseUrl}/secure`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(response.status, 200);
    const body = (await response.json()) as { ok: boolean };
    assert.equal(body.ok, true);
  } finally {
    server.close();
  }
});

test("integration: permission route returns forbidden for missing permission", async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const token = makeToken(["sales.view"]);
    const response = await fetch(`${baseUrl}/secure-permission`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(response.status, 403);
  } finally {
    server.close();
  }
});

test("integration: permission route succeeds with required permission", async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const token = makeToken(["reports.view"]);
    const response = await fetch(`${baseUrl}/secure-permission`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(response.status, 200);
    const body = (await response.json()) as { ok: boolean };
    assert.equal(body.ok, true);
  } finally {
    server.close();
  }
});
