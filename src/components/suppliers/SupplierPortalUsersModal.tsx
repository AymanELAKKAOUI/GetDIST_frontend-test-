import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Key, Pencil, Plus, Trash2, UserCheck, UserX } from 'lucide-react';
import { apiClient, getApiErrorMessage } from '../../api/client';
import type { User } from '../../types/admin';
import { Badge } from '../ui/Badge';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Modal } from '../ui/Modal';
import { Spinner } from '../ui/Spinner';
import { useToast } from '../ui/Toast';
import { ResetPasswordModal } from '../users/ResetPasswordModal';
import { PortalUserEditModal } from './PortalUserEditModal';
import { ProvisionPortalUserModal } from './ProvisionPortalUserModal';
import './SupplierPortalUsersModal.css';

interface SupplierPortalUsersModalProps {
  isOpen: boolean;
  supplierId: string | null;
  supplierName: string;
  onClose: () => void;
}

function mapPortalUser(raw: {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  createdAt: string;
  roles: Array<{ id: string; name: string }>;
}): User {
  return {
    id: raw.id,
    email: raw.email,
    fullName: raw.fullName,
    isActive: raw.isActive,
    createdAt: raw.createdAt,
    supplierId: null,
    supplierName: null,
    roles: raw.roles,
  };
}

export function SupplierPortalUsersModal({
  isOpen,
  supplierId,
  supplierName,
  onClose,
}: SupplierPortalUsersModalProps) {
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    if (!supplierId) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.get<{ users: User[] }>(
        `/api/suppliers/${supplierId}/users`,
      );
      setUsers(data.users.map(mapPortalUser));
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        setError('Could not load portal users. The supplier may not exist.');
      } else {
        setError(getApiErrorMessage(err, 'Failed to load portal users.'));
      }
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [supplierId]);

  useEffect(() => {
    if (isOpen && supplierId) {
      fetchUsers();
    } else {
      setUsers([]);
      setError(null);
      setCreateOpen(false);
      setEditTarget(null);
      setResetTarget(null);
      setDeleteTarget(null);
    }
  }, [isOpen, supplierId, fetchUsers]);

  const handleToggleActive = async (user: User) => {
    setTogglingId(user.id);
    try {
      const { data } = await apiClient.patch<{ user: User }>(`/api/admin/users/${user.id}`, {
        isActive: !user.isActive,
      });
      setUsers((prev) => prev.map((u) => (u.id === user.id ? data.user : u)));
      showToast(data.user.isActive ? 'Portal user activated.' : 'Portal user deactivated.');
    } catch {
      showToast('Failed to update user status.', 'error');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await apiClient.delete(`/api/admin/users/${deleteTarget.id}`);
      setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id));
      showToast('Portal user deleted.');
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(getApiErrorMessage(err, 'Failed to delete portal user.'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Modal
        id="supplier-portal-users-modal"
        title={`Portal Users — ${supplierName}`}
        isOpen={isOpen}
        onClose={onClose}
        maxWidth={920}
        className="modal--portal-users"
      >
        <p className="portal-users-modal__subtitle">
          Accounts that can sign in to the supplier portal for this vendor.
        </p>

        {error && (
          <div className="alert-error" role="alert">
            {error}
          </div>
        )}

        <div className="portal-users-toolbar">
          <button
            type="button"
            className="btn btn--sm"
            id="portal-users-add"
            onClick={() => setCreateOpen(true)}
            disabled={!supplierId}
          >
            <Plus size={16} />
            Add user
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
            <Spinner size={28} />
          </div>
        ) : users.length === 0 && !error ? (
          <div className="portal-users-empty">
            No portal users yet. Click &quot;Add user&quot; to create one.
          </div>
        ) : (
          <div className="table-card">
            <table className="data-table portal-users-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th style={{ minWidth: 160, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} id={`portal-user-row-${user.id}`}>
                    <td>{user.fullName}</td>
                    <td>{user.email}</td>
                    <td>
                      <Badge variant={user.isActive ? 'active' : 'inactive'}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td>
                      <div className="portal-users-actions">
                        <button
                          type="button"
                          className="btn--icon"
                          aria-label={`Edit ${user.fullName}`}
                          title="Edit"
                          onClick={() => setEditTarget(user)}
                        >
                          <Pencil size={18} />
                        </button>
                        <button
                          type="button"
                          className="btn--icon"
                          disabled={togglingId === user.id}
                          aria-label={user.isActive ? `Deactivate ${user.fullName}` : `Activate ${user.fullName}`}
                          title={user.isActive ? 'Deactivate' : 'Activate'}
                          onClick={() => handleToggleActive(user)}
                        >
                          {user.isActive ? <UserX size={18} /> : <UserCheck size={18} />}
                        </button>
                        <button
                          type="button"
                          className="btn--icon"
                          aria-label={`Reset password for ${user.fullName}`}
                          title="Reset password"
                          onClick={() => setResetTarget(user)}
                        >
                          <Key size={18} />
                        </button>
                        <button
                          type="button"
                          className="btn--icon btn--icon-danger"
                          aria-label={`Delete ${user.fullName}`}
                          title="Delete"
                          onClick={() => setDeleteTarget(user)}
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      <ProvisionPortalUserModal
        isOpen={createOpen}
        supplierId={supplierId}
        supplierName={supplierName}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => {
          showToast('Portal user created successfully.');
          setCreateOpen(false);
          fetchUsers();
        }}
      />

      <PortalUserEditModal
        isOpen={!!editTarget}
        user={editTarget}
        onClose={() => setEditTarget(null)}
        onSuccess={(updated) => {
          setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
          showToast('Portal user updated.');
          setEditTarget(null);
        }}
      />

      <ResetPasswordModal
        isOpen={!!resetTarget}
        userId={resetTarget?.id ?? null}
        userName={resetTarget?.fullName ?? ''}
        onClose={() => setResetTarget(null)}
        onSuccess={() => showToast('Password reset successfully.')}
      />

      <ConfirmDialog
        id="delete-portal-user-dialog"
        isOpen={!!deleteTarget}
        title="Delete Portal User"
        message={`Delete portal account for ${deleteTarget?.fullName ?? 'this user'}? This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        isLoading={deleting}
        error={deleteError}
        onConfirm={handleDeleteConfirm}
        onCancel={() => {
          setDeleteTarget(null);
          setDeleteError(null);
        }}
      />
    </>
  );
}
