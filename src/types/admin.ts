export interface Role {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
}

export interface Permission {
  code: string;
  description: string;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  createdAt: string;
  supplierId: string | null;
  supplierName: string | null;
  roles: Array<{ id: string; name: string }>;
}

export function isSupplierPortalUser(user: User): boolean {
  return user.supplierId != null;
}

export function getRoleBadgeStyle(): { bg: string; color: string } {
  return {
    bg: 'var(--role-badge-bg)',
    color: 'var(--role-badge-text)',
  };
}

export function normalizePermissionList(raw: unknown): Permission[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => {
      if (typeof item === 'string') {
        return { code: item, description: '' };
      }
      if (item && typeof item === 'object' && 'code' in item) {
        const record = item as { code: unknown; description?: unknown };
        return {
          code: String(record.code),
          description: record.description != null ? String(record.description) : '',
        };
      }
      return null;
    })
    .filter((item): item is Permission => !!item?.code);
}

export function normalizeRolePermissions(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String).filter(Boolean);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];

    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        if (Array.isArray(parsed)) {
          return parsed.map(String).filter(Boolean);
        }
      } catch {
        /* fall through */
      }
    }

    return trimmed.split(/[\s,]+/).filter(Boolean);
  }

  return [];
}

export function normalizeRole(role: Role): Role {
  return {
    ...role,
    permissions: normalizeRolePermissions(role.permissions),
  };
}

export function toSnakeCase(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, '_')
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .toUpperCase();
}

export function groupPermissions(permissions: Permission[]): Map<string, Permission[]> {
  const groups = new Map<string, Permission[]>();

  for (const perm of permissions) {
    const prefix = perm.code.split('.')[0] ?? 'other';
    const existing = groups.get(prefix) ?? [];
    existing.push(perm);
    groups.set(prefix, existing);
  }

  return new Map([...groups.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

export function formatGroupTitle(prefix: string): string {
  const special: Record<string, string> = {
    rbac: 'RBAC',
    po: 'Purchase Order',
  };
  if (special[prefix]) return special[prefix];
  return prefix.charAt(0).toUpperCase() + prefix.slice(1).replace(/_/g, ' ');
}
