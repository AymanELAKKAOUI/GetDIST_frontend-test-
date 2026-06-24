import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { apiClient } from '../../api/client';
import type { Permission, Role } from '../../types/admin';
import {
  getRoleBadgeStyle,
  normalizePermissionList,
  normalizeRole,
  toSnakeCase,
} from '../../types/admin';
import { Badge } from '../ui/Badge';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { SearchInput } from '../ui/SearchInput';
import { useToast } from '../ui/Toast';
import { RoleFormModal } from './RoleFormModal';
import './RolesPage.css';

function TableSkeleton() {
  return (
    <div className="table-card" style={{ padding: '16px 0' }}>
      {[1, 2, 3].map((i) => (
        <div key={i} className="skeleton skeleton-row" />
      ))}
    </div>
  );
}

export function RolesPage() {
  const { showToast } = useToast();
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [permissionsLoading, setPermissionsLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get<{ roles: Role[] }>('/api/admin/roles');
      setRoles(data.roles.map(normalizeRole));
    } catch {
      showToast('Failed to load roles.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const fetchPermissions = useCallback(async () => {
    setPermissionsLoading(true);
    try {
      const { data } = await apiClient.get<{ permissions: Permission[] }>('/api/admin/permissions');
      setPermissions(normalizePermissionList(data.permissions));
    } catch {
      showToast('Failed to load permissions.', 'error');
      setPermissions([]);
    } finally {
      setPermissionsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchRoles();
    fetchPermissions();
  }, [fetchRoles, fetchPermissions]);

  const filteredRoles = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return roles;

    return roles.filter((role) => {
      const haystack = [
        role.name,
        role.description ?? '',
        toSnakeCase(role.name),
        ...role.permissions,
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [roles, search]);

  const handleCreate = () => {
    setEditingRole(null);
    setFormOpen(true);
  };

  const handleEdit = (role: Role) => {
    setEditingRole(role);
    setFormOpen(true);
  };

  const handleFormSuccess = (role: Role) => {
    const normalized = normalizeRole(role);
    setRoles((prev) => {
      const idx = prev.findIndex((r) => r.id === normalized.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = normalized;
        return next;
      }
      return [...prev, normalized];
    });
    showToast(editingRole ? 'Role updated successfully.' : 'Role created successfully.');
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);

    try {
      await apiClient.delete(`/api/admin/roles/${deleteTarget.id}`);
      setRoles((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      showToast('Role deleted successfully.');
      setDeleteTarget(null);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const data = err.response?.data as { error?: string; message?: string } | undefined;
        if (data?.error === 'ROLE_IN_USE') {
          setDeleteError('Cannot delete a role that is assigned to active users.');
        } else {
          setDeleteError(data?.message ?? 'Failed to delete role.');
        }
      } else {
        setDeleteError('An unexpected error occurred.');
      }
    } finally {
      setDeleting(false);
    }
  };

  const roleBadgeStyle = getRoleBadgeStyle();

  return (
    <div id="roles-page">
      <div className="page-header">
        <div>
          <h1 className="page-header__title" id="roles-title">
            Roles & Permissions
          </h1>
          <p className="page-header__subtitle">
            Define access levels by combining role names with permission sets.
          </p>
        </div>
        <button type="button" className="btn" id="create-role-btn" onClick={handleCreate}>
          <Plus size={16} />
          Create role
        </button>
      </div>

      {!loading && (
        <div className="page-toolbar">
          <SearchInput
            id="roles-search"
            value={search}
            onChange={setSearch}
            placeholder="Search roles or permissions…"
          />
          <span className="page-toolbar__count" id="roles-count">
            {filteredRoles.length} of {roles.length} roles
          </span>
        </div>
      )}

      {loading ? (
        <TableSkeleton />
      ) : (
        <div className="table-card">
          <table className="data-table" id="roles-table">
            <thead>
              <tr>
                <th style={{ width: '30%' }}>Role</th>
                <th>Permissions</th>
                <th style={{ width: 80 }} />
              </tr>
            </thead>
            <tbody>
              {filteredRoles.map((role) => (
                <tr key={role.id} id={`role-row-${role.id}`}>
                  <td>
                    <div className="role-cell">
                      <Badge
                        variant="role"
                        style={{ background: roleBadgeStyle.bg, color: roleBadgeStyle.color }}
                      >
                        {role.name}
                      </Badge>
                      <span className="role-cell__code">{toSnakeCase(role.name)}</span>
                    </div>
                  </td>
                  <td>
                    <div className="permissions-pills">
                      {role.permissions.map((code) => (
                        <Badge key={code} variant="permission">
                          {code}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        type="button"
                        className="btn--icon"
                        id={`edit-role-${role.id}`}
                        onClick={() => handleEdit(role)}
                        aria-label={`Edit ${role.name}`}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        className="btn--icon btn--icon-danger"
                        id={`delete-role-${role.id}`}
                        onClick={() => {
                          setDeleteError(null);
                          setDeleteTarget(role);
                        }}
                        aria-label={`Delete ${role.name}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredRoles.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 32 }}>
                    {roles.length === 0 ? 'No roles found.' : 'No roles match your search.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <RoleFormModal
        isOpen={formOpen}
        role={editingRole}
        allPermissions={permissions}
        permissionsLoading={permissionsLoading}
        onClose={() => setFormOpen(false)}
        onSuccess={handleFormSuccess}
      />

      <ConfirmDialog
        id="delete-role-dialog"
        isOpen={!!deleteTarget}
        title="Delete Role"
        message={
          <>
            Are you sure you want to delete the role <strong>{deleteTarget?.name}</strong>? This
            action cannot be undone.
          </>
        }
        confirmLabel="Delete"
        destructive
        isLoading={deleting}
        error={deleteError}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
