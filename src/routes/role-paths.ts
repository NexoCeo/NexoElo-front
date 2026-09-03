export type AppRole = "EMPRESA" | "AUTONOMO" | "PROFISSIONAL";

const ROLE_BASE_PATHS: Record<AppRole, string> = {
  EMPRESA: "/empresa",
  AUTONOMO: "/autonomo",
  PROFISSIONAL: "/profissional",
};

export function normalizeRole(role?: string | null): AppRole | null {
  const normalizedRole = role?.toUpperCase();

  if (
    normalizedRole === "EMPRESA" ||
    normalizedRole === "AUTONOMO" ||
    normalizedRole === "PROFISSIONAL"
  ) {
    return normalizedRole;
  }

  return null;
}

export function getRoleBasePath(role?: string | null) {
  const normalizedRole = normalizeRole(role);
  return normalizedRole ? ROLE_BASE_PATHS[normalizedRole] : ROLE_BASE_PATHS.EMPRESA;
}

export function getRoleDashboardPath(role?: string | null) {
  return `${getRoleBasePath(role)}/dashboard`;
}

export function getRoleLoginPath(role?: string | null) {
  return `${getRoleBasePath(role)}/login`;
}

export function getRolePagePath(role: string | null | undefined, page: string) {
  return `${getRoleBasePath(role)}/${page.replace(/^\/+/, "")}`;
}
