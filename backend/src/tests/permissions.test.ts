import assert from "node:assert/strict";
import test from "node:test";
import type { AuthUser } from "../middleware/auth";
import { hasPermission, enforceNonTaxPermission } from "../middleware/permissions";

function makeAuth(permissions: string[]): AuthUser {
  return {
    sub: "user-1",
    businessId: "business-1",
    roleId: "role-1",
    permissions,
  };
}

test("hasPermission returns true for wildcard", () => {
  const auth = makeAuth(["*"]);
  assert.equal(hasPermission(auth, "sales.create"), true);
  assert.equal(hasPermission(auth, "purchases.view"), true);
});

test("hasPermission returns true only for granted permission", () => {
  const auth = makeAuth(["sales.view", "sales.create"]);
  assert.equal(hasPermission(auth, "sales.view"), true);
  assert.equal(hasPermission(auth, "purchases.view"), false);
});

test("enforceNonTaxPermission allows when non-tax permission exists", () => {
  const auth = makeAuth(["sales.non_tax.view", "sales.non_tax.create", "sales.non_tax.print"]);
  assert.doesNotThrow(() => enforceNonTaxPermission(auth, "view"));
  assert.doesNotThrow(() => enforceNonTaxPermission(auth, "create"));
  assert.doesNotThrow(() => enforceNonTaxPermission(auth, "print"));
});

test("enforceNonTaxPermission throws when missing permission", () => {
  const auth = makeAuth(["sales.view"]);
  assert.throws(() => enforceNonTaxPermission(auth, "view"));
  assert.throws(() => enforceNonTaxPermission(auth, "create"));
  assert.throws(() => enforceNonTaxPermission(auth, "print"));
});
