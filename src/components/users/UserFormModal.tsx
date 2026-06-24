import { useEffect, useRef, useState, type FormEvent } from 'react';
import axios from 'axios';
import { ChevronDown, Eye, EyeOff, X } from 'lucide-react';
import { apiClient, getApiErrorMessage, getValidationErrors } from '../../api/client';
import type { Role, User } from '../../types/admin';
import { Modal } from '../ui/Modal';
import './UserFormModal.css';

interface UserFormModalProps {
  isOpen: boolean;
  user: User | null;
  roles: Role[];
  onClose: () => void;
  onSuccess: (user?: User, userId?: string) => void;
}

export function UserFormModal({ isOpen, user, roles, onClose, onSuccess }: UserFormModalProps) {
  const isEdit = !!user;
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRoleIds, setSelectedRoleIds] = useState<Set<string>>(new Set());
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setEmail(user?.email ?? '');
    setFullName(user?.fullName ?? '');
    setPassword('');
    setShowPassword(false);
    setSelectedRoleIds(new Set(user?.roles.map((r) => r.id) ?? []));
    setError(null);
    setFieldErrors({});
    setDropdownOpen(false);
  }, [isOpen, user]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleRole = (roleId: string) => {
    setSelectedRoleIds((prev) => {
      const next = new Set(prev);
      if (next.has(roleId)) next.delete(roleId);
      else next.add(roleId);
      return next;
    });
  };

  const removeRole = (roleId: string) => {
    setSelectedRoleIds((prev) => {
      const next = new Set(prev);
      next.delete(roleId);
      return next;
    });
  };

  const selectedRoles = roles.filter((r) => selectedRoleIds.has(r.id));
  const availableRoles = roles.filter((r) => !selectedRoleIds.has(r.id));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    if (selectedRoleIds.size === 0) {
      setFieldErrors({ roles: 'At least one role must be assigned.' });
      return;
    }

    setSubmitting(true);

    try {
      if (isEdit && user) {
        const { data } = await apiClient.patch<{ user: User }>(`/api/admin/users/${user.id}`, {
          fullName: fullName.trim(),
          roleIds: [...selectedRoleIds],
        });
        onSuccess(data.user);
      } else {
        const { data } = await apiClient.post<{ userId: string }>('/api/admin/users', {
          email: email.trim(),
          fullName: fullName.trim(),
          password,
          roleIds: [...selectedRoleIds],
        });
        onSuccess(undefined, data.userId);
      }
      onClose();
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const validation = getValidationErrors(err);
        if (Object.keys(validation).length > 0) {
          setFieldErrors(validation);
        } else {
          setError(getApiErrorMessage(err));
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
      id="user-form-modal"
      title={isEdit ? 'Edit User' : 'Create User'}
      isOpen={isOpen}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} id="user-form">
        {error && (
          <div className="alert-error" id="user-form-error" role="alert">
            {error}
          </div>
        )}

        {!isEdit && (
          <div className="form-group">
            <label className="form-label" htmlFor="user-email">
              Email
            </label>
            <input
              id="user-email"
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {fieldErrors.email && <div className="form-error">{fieldErrors.email}</div>}
          </div>
        )}

        <div className="form-group">
          <label className="form-label" htmlFor="user-full-name">
            Full Name
          </label>
          <input
            id="user-full-name"
            className="form-input"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            maxLength={255}
            required
          />
          {fieldErrors.fullName && <div className="form-error">{fieldErrors.fullName}</div>}
        </div>

        {!isEdit && (
          <div className="form-group">
            <label className="form-label" htmlFor="user-password">
              Password
            </label>
            <div className="password-field">
              <input
                id="user-password"
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                maxLength={128}
                required
              />
              <button
                type="button"
                className="password-field__toggle"
                id="user-password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {fieldErrors.password && <div className="form-error">{fieldErrors.password}</div>}
          </div>
        )}

        <div className="form-group">
          <label className="form-label" htmlFor="user-roles-select">
            Roles
          </label>
          <div className="role-select" ref={dropdownRef}>
            <button
              type="button"
              className="role-select__trigger form-input"
              id="user-roles-select"
              onClick={() => setDropdownOpen((v) => !v)}
            >
              <span className="role-select__placeholder">
                {availableRoles.length > 0 ? 'Select roles…' : 'All roles selected'}
              </span>
              <ChevronDown size={16} />
            </button>
            {dropdownOpen && availableRoles.length > 0 && (
              <div className="role-select__dropdown" id="user-roles-dropdown">
                {availableRoles.map((role) => (
                  <button
                    key={role.id}
                    type="button"
                    className="role-select__option"
                    id={`role-option-${role.id}`}
                    onClick={() => {
                      toggleRole(role.id);
                      setDropdownOpen(false);
                    }}
                  >
                    {role.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          {fieldErrors.roles && <div className="form-error">{fieldErrors.roles}</div>}
          {selectedRoles.length > 0 && (
            <div className="selected-roles" id="selected-roles">
              {selectedRoles.map((role) => (
                <span key={role.id} className="selected-role-pill">
                  {role.name}
                  <button
                    type="button"
                    className="selected-role-pill__remove"
                    id={`remove-role-${role.id}`}
                    onClick={() => removeRole(role.id)}
                    aria-label={`Remove ${role.name}`}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="modal__footer">
          <button
            type="button"
            className="btn btn--ghost"
            id="user-form-cancel"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button type="submit" className="btn" id="user-form-submit" disabled={submitting}>
            {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create User'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
