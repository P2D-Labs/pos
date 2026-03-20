export type AuthState = {
  accessToken: string;
  refreshToken: string;
  permissions: string[];
};

const STORAGE_KEY = "pos-auth";

export function getAuthState(): AuthState | null {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  return raw ? (JSON.parse(raw) as AuthState) : null;
}

export function setAuthState(auth: AuthState | null) {
  if (!auth) {
    sessionStorage.removeItem(STORAGE_KEY);
    return;
  }
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
}

export function buildAuthState(input: { accessToken: string; refreshToken: string }): AuthState {
  const permissions = extractPermissionsFromToken(input.accessToken);
  return {
    accessToken: input.accessToken,
    refreshToken: input.refreshToken,
    permissions,
  };
}

function extractPermissionsFromToken(token: string): string[] {
  try {
    const payloadPart = token.split(".")[1];
    if (!payloadPart) return [];
    const base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const decoded = JSON.parse(atob(padded)) as { permissions?: unknown };
    return Array.isArray(decoded.permissions)
      ? decoded.permissions.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}
