import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Key, Pencil, Plus, Trash2 } from 'lucide-react';
import { apiClient } from '../../api/client';
import type { Role, User } from '../../types/admin';
import { normalizeRole } from '../../types/admin';
import { Badge } from '../ui/Badge';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { SearchInput } from '../ui/SearchInput';
import { useToast } from '../ui/Toast';
import { UserFormModal } from './UserFormModal';
import { ResetPasswordModal } from './ResetPasswordModal';
import './UsersPage.css';

function TableSkeleton() {
  return (
    <div className="table-card" style={{ padding: '16px 0' }}>
      {[1, 2, 3].map((i) => (
        <div key={i} className="skeleton skeleton-row" />
      ))}
    </div>
  );
}

export function UsersPage() {
  const { showToast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, rolesRes] = await Promise.all([
        apiClient.get<{ users: User[] }>('/api/admin/users'),
        apiClient.get<{ roles: Role[] }>('/api/admin/roles'),
      ]);
      setUsers(usersRes.data.users);
      setRoles(rolesRes.data.roles.map(normalizeRole));
    } catch {
      showToast('Failed to load users.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return users;

    return users.filter((user) => {
      const haystack = [
        user.fullName,
        user.email,
        user.isActive ? 'active' : 'inactive',
        ...user.roles.map((role) => role.name),
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [users, search]);

  const handleToggleActive = async (user: User) => {
    setTogglingId(user.id);
    try {
      const { data } = await apiClient.patch<{ user: User }>(`/api/admin/users/${user.id}`, {
        isActive: !user.isActive,
      });
      setUsers((prev) => prev.map((u) => (u.id === user.id ? data.user : u)));
      showToast(
        data.user.isActive ? 'User activated successfully.' : 'User deactivated successfully.',
      );
    } catch {
      showToast('Failed to update user status.', 'error');
    } finally {
      setTogglingId(null);
    }
  };

  const handleFormSuccess = async (user?: User) => {
    if (user) {
      setUsers((prev) => prev.map((u) => (u.id === user.id ? user : u)));
      showToast('User updated successfully.');
    } else {
      await fetchData();
      showToast('User created successfully.');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);

    try {
      await apiClient.delete(`/api/admin/users/${deleteTarget.id}`);
      setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id));
      showToast('User deleted successfully.');
      setDeleteTarget(null);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const data = err.response?.data as { error?: string; message?: string } | undefined;
        if (data?.error === 'CANNOT_DELETE_SELF') {
          setDeleteError('You cannot delete your own account.');
        } else {
          setDeleteError(data?.message ?? 'Failed to delete user.');
        }
      } else {
        setDeleteError('An unexpected error occurred.');
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div id="users-page">
      <div className="page-header">
        <div>
          <h1 className="page-header__title" id="users-title">
            Users
          </h1>
          <p className="page-header__subtitle">
            Manage team members and their access levels.
          </p>
        </div>
        <button
          type="button"
          className="btn"
          id="create-user-btn"
          onClick={() => {
            setEditingUser(null);
            setFormOpen(true);
          }}
        >
          <Plus size={16} />
          Create user
        </button>
      </div>

      {!loading && (
        <div className="page-toolbar">
          <SearchInput
            id="users-search"
            value={search}
            onChange={setSearch}
            placeholder="Search users by name, email, or role…"
          />
          <span className="page-toolbar__count" id="users-count">
            {filteredUsers.length} of {users.length} users
          </span>
        </div>
      )}

      {loading ? (
        <TableSkeleton />
      ) : (
        <div className="table-card">
          <table className="data-table" id="users-table">
            <thead>
              <tr>
                <th>Full Name</th>
                <th>Email</th>
                <th>Status</th>
                <th>Roles</th>
                <th style={{ width: 120 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id} id={`user-row-${user.id}`}>
                  <td>
                    <span className="user-name">{user.fullName}</span>
                  </td>
                  <td>
                    <span className="user-email">{user.email}</span>
                  </td>
                  <td>
                    <div className="status-cell">
                      <button
                        type="button"
                        className={`toggle-switch ${user.isActive ? 'toggle-switch--active' : ''}`}
                        id={`toggle-active-${user.id}`}
                        onClick={() => handleToggleActive(user)}
                        disabled={togglingId === user.id}
                        aria-label={user.isActive ? 'Deactivate user' : 'Activate user'}
                        role="switch"
                        aria-checked={user.isActive}
                      >
                        <span className="toggle-switch__knob" />
                      </button>
                      <Badge variant={user.isActive ? 'active' : 'inactive'}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </td>
                  <td>
                    <div className="user-roles-pills">
                      {user.roles.map((role) => (
                        <span key={role.id} className="user-role-pill">
                          {role.name}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <div className="actions-cell">
                      <button
                        type="button"
                        className="btn--icon"
                        id={`edit-user-${user.id}`}
                        onClick={() => {
                          setEditingUser(user);
                          setFormOpen(true);
                        }}
                        aria-label={`Edit ${user.fullName}`}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        className="btn--icon"
                        id={`reset-password-${user.id}`}
                        onClick={() => setResetTarget(user)}
                        aria-label={`Reset password for ${user.fullName}`}
                      >
                        <Key size={16} />
                      </button>
                      <button
                        type="button"
                        className="btn--icon btn--icon-danger"
                        id={`delete-user-${user.id}`}
                        onClick={() => {
                          setDeleteError(null);
                          setDeleteTarget(user);
                        }}
                        aria-label={`Delete ${user.fullName}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 32 }}>
                    {users.length === 0 ? 'No users found.' : 'No users match your search.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <UserFormModal
        isOpen={formOpen}
        user={editingUser}
        roles={roles}
        onClose={() => setFormOpen(false)}
        onSuccess={handleFormSuccess}
      />

      <ResetPasswordModal
        isOpen={!!resetTarget}
        userId={resetTarget?.id ?? null}
        userName={resetTarget?.fullName ?? ''}
        onClose={() => setResetTarget(null)}
        onSuccess={() => showToast('Password has been reset successfully.')}
      />

      <ConfirmDialog
        id="delete-user-dialog"
        isOpen={!!deleteTarget}
        title="Delete User"
        message={
          <>
            Are you sure you want to delete <strong>{deleteTarget?.fullName}</strong>? This will
            revoke all access and remove them from the system.
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
