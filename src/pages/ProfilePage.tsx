import { useState, type FormEvent } from 'react';
import axios from 'axios';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiClient, getApiErrorMessage } from '../api/client';
import { formatGroupTitle, groupPermissions } from '../types/admin';
import { Badge } from '../components/ui/Badge';
import { useToast } from '../components/ui/Toast';
import '../components/users/UserFormModal.css';
import './ProfilePage.css';

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function ProfilePage() {
  const { user, permissions } = useAuth();
  const { showToast } = useToast();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const permissionGroups = groupPermissions(
    permissions.map((code) => ({ code, description: '' })),
  );

  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setFieldErrors({});

    const errors: Record<string, string> = {};
    if (!currentPassword) errors.currentPassword = 'Current password is required.';
    if (newPassword.length < 8) errors.newPassword = 'New password must be at least 8 characters.';
    if (newPassword.length > 128) errors.newPassword = 'New password must be at most 128 characters.';
    if (newPassword !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.post('/api/auth/change-password', {
        currentPassword,
        newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showToast('Password updated successfully.');
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const data = err.response?.data as { message?: string } | undefined;
        setPasswordError(data?.message ?? getApiErrorMessage(err, 'Failed to update password.'));
      } else {
        setPasswordError('An unexpected error occurred.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <div className="profile-page" id="profile-page">
      <h1 className="page-title" id="profile-title">
        My Profile
      </h1>

      <div className="profile-grid">
        <div className="profile-card" id="profile-account-card">
          <h2 className="profile-card__title">Account Information</h2>

          <div className="profile-avatar" id="profile-avatar" aria-hidden="true">
            {getInitials(user.fullName)}
          </div>

          <h3 className="profile-name" id="profile-full-name">
            {user.fullName}
          </h3>
          <p className="profile-email" id="profile-email">
            {user.email}
          </p>

          <div className="profile-ids">
            <div className="profile-id-row">
              <span className="profile-id-label">Company ID</span>
              <span className="profile-id-value" id="profile-company-id">
                {user.companyId}
              </span>
            </div>
            <div className="profile-id-row">
              <span className="profile-id-label">Supplier ID</span>
              <span className="profile-id-value" id="profile-supplier-id">
                {user.supplierId ?? '—'}
              </span>
            </div>
          </div>

          <div className="profile-permissions">
            <h4 className="profile-permissions__title">Assigned Permissions</h4>
            {permissions.length === 0 ? (
              <p className="profile-permissions__empty" id="profile-no-permissions">
                No permissions assigned.
              </p>
            ) : (
              <div className="profile-permissions__groups">
                {[...permissionGroups.entries()].map(([prefix, perms]) => (
                  <div key={prefix} className="profile-permissions__group" id={`perm-group-${prefix}`}>
                    <div className="profile-permissions__group-label">
                      {formatGroupTitle(prefix)}
                    </div>
                    <div className="profile-permissions__pills">
                      {perms.map((perm) => (
                        <Badge key={perm.code} variant="permission">
                          {perm.code}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="profile-card" id="profile-security-card">
          <h2 className="profile-card__title">Security & Password</h2>

          {passwordError && (
            <div className="alert-error" id="profile-password-error" role="alert">
              {passwordError}
            </div>
          )}

          <form onSubmit={handlePasswordSubmit} id="change-password-form">
            <div className="form-group">
              <label className="form-label" htmlFor="profile-current-password">
                Current Password
              </label>
              <div className="password-field">
                <input
                  id="profile-current-password"
                  type={showCurrent ? 'text' : 'password'}
                  className="form-input"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="password-field__toggle"
                  id="profile-current-password-toggle"
                  onClick={() => setShowCurrent((v) => !v)}
                  aria-label={showCurrent ? 'Hide password' : 'Show password'}
                >
                  {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {fieldErrors.currentPassword && (
                <div className="form-error">{fieldErrors.currentPassword}</div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="profile-new-password">
                New Password
              </label>
              <div className="password-field">
                <input
                  id="profile-new-password"
                  type={showNew ? 'text' : 'password'}
                  className="form-input"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  required
                />
                <button
                  type="button"
                  className="password-field__toggle"
                  id="profile-new-password-toggle"
                  onClick={() => setShowNew((v) => !v)}
                  aria-label={showNew ? 'Hide password' : 'Show password'}
                >
                  {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {fieldErrors.newPassword && (
                <div className="form-error">{fieldErrors.newPassword}</div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="profile-confirm-password">
                Confirm New Password
              </label>
              <input
                id="profile-confirm-password"
                type="password"
                className="form-input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
              {fieldErrors.confirmPassword && (
                <div className="form-error">{fieldErrors.confirmPassword}</div>
              )}
            </div>

            <button
              type="submit"
              className="btn"
              id="profile-change-password-submit"
              disabled={submitting}
            >
              {submitting ? 'Updating…' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
