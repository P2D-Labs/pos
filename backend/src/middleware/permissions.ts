import type { AuthUser } from "./auth";
import { HttpError } from "../lib/http";

export function hasPermission(auth: AuthUser, permission: string) {
  return auth.permissions.includes("*") || auth.permissions.includes(permission);
}

export function enforceNonTaxPermission(auth: AuthUser, action: "view" | "create" | "print") {
  const permission =
    action === "view" ? "sales.non_tax.view" : action === "print" ? "sales.non_tax.print" : "sales.non_tax.create";
  if (!hasPermission(auth, permission)) {
    throw new HttpError(403, `Missing permission: ${permission}`);
  }
}
