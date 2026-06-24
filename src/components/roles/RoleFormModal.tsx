import { useEffect, useMemo, useState, type FormEvent } from 'react';
import axios from 'axios';
import { apiClient, getApiErrorMessage, getValidationErrors } from '../../api/client';
import type { Permission, Role } from '../../types/admin';
import { normalizePermissionList, normalizeRolePermissions } from '../../types/admin';
import { Modal } from '../ui/Modal';
import { Spinner } from '../ui/Spinner';
import './RoleFormModal.css';

interface RoleFormModalProps {
  isOpen: boolean;
  role: Role | null;
  allPermissions: Permission[];
  permissionsLoading?: boolean;
  onClose: () => void;
  onSuccess: (role: Role) => void;
}

export function RoleFormModal({
  isOpen,
  role,
  allPermissions,
  permissionsLoading = false,
  onClose,
  onSuccess,
}: RoleFormModalProps) {
  const isEdit = !!role;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen) return;

    setName(role?.name ?? '');
    setDescription(role?.description ?? '');
    setSelectedCodes(new Set(normalizeRolePermissions(role?.permissions)));
    setError(null);
    setFieldErrors({});
  }, [isOpen, role]);

  const permissions = useMemo(
    () => normalizePermissionList(allPermissions).sort((a, b) => a.code.localeCompare(b.code)),
    [allPermissions],
  );

  const togglePermission = (code: string) => {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setSubmitting(true);

    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      permissionCodes: [...selectedCodes],
    };

    try {
      if (isEdit && role) {
        const { data } = await apiClient.patch<{ role: Role }>(
          `/api/admin/roles/${role.id}`,
          payload,
        );
        onSuccess(data.role);
      } else {
        const { data } = await apiClient.post<{ role: Role }>('/api/admin/roles', payload);
        onSuccess(data.role);
      }
      onClose();
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const data = err.response?.data as { error?: string; message?: string } | undefined;
        if (err.response?.status === 409 || data?.error === 'CONFLICT') {
          setError('A role with this name already exists.');
        } else {
          const validation = getValidationErrors(err);
          if (Object.keys(validation).length > 0) {
            setFieldErrors(validation);
          } else {
            setError(getApiErrorMessage(err));
          }
        }
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      id="role-form-modal"
      title={isEdit ? 'Edit role' : 'Create role'}
      isOpen={isOpen}
      onClose={onClose}
      maxWidth={560}
      className="modal--role-form"
    >
      <form onSubmit={handleSubmit} id="role-form" className="role-form">
        <div className="role-form__scroll">
          {error && (
            <div className="alert-error" id="role-form-error" role="alert">
              {error}
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="role-name">
              Role name
            </label>
            <input
              id="role-name"
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              placeholder="Depot Supervisor"
              required
            />
            {fieldErrors.name && <div className="form-error">{fieldErrors.name}</div>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="role-description">
              Description
            </label>
            <textarea
              id="role-description"
              className="form-textarea role-form__description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="Optional description"
            />
            {fieldErrors.description && <div className="form-error">{fieldErrors.description}</div>}
          </div>

          <div className="form-group role-form__permissions">
            <label className="form-label" htmlFor="permission-matrix">
              Permissions
            </label>

            {permissionsLoading ? (
              <div className="role-form__loading">
                <Spinner size={24} />
              </div>
            ) : permissions.length === 0 ? (
              <div className="role-form__empty" id="permission-matrix-empty">
                No permissions available.
              </div>
            ) : (
              <div className="permission-picker" id="permission-matrix" role="group" aria-label="Permissions">
                {permissions.map((perm) => {
                  const selected = selectedCodes.has(perm.code);
                  return (
                    <button
                      key={perm.code}
                      type="button"
                      id={`perm-${perm.code.replace(/\./g, '-')}`}
                      className={`permission-picker__pill ${selected ? 'permission-picker__pill--selected' : ''}`}
                      onClick={() => togglePermission(perm.code)}
                      aria-pressed={selected}
                      title={perm.description || perm.code}
                    >
                      {perm.code}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="modal__footer role-form__footer">
          <button
            type="button"
            className="btn btn--ghost"
            id="role-form-cancel"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button type="submit" className="btn" id="role-form-submit" disabled={submitting}>
            {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create role'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
