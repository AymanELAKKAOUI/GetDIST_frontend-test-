import { useState, type FormEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { apiClient, getApiErrorMessage } from '../../api/client';
import { Modal } from '../ui/Modal';
import './UserFormModal.css';

interface ResetPasswordModalProps {
  isOpen: boolean;
  userId: string | null;
  userName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function ResetPasswordModal({
  isOpen,
  userId,
  userName,
  onClose,
  onSuccess,
}: ResetPasswordModalProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setPassword('');
    setShowPassword(false);
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    setError(null);
    setSubmitting(true);

    try {
      await apiClient.post(`/api/admin/users/${userId}/reset-password`, {
        newPassword: password,
      });
      onSuccess();
      handleClose();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to reset password.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      id="reset-password-modal"
      title={`Reset Password for ${userName}`}
      isOpen={isOpen}
      onClose={handleClose}
    >
      <form onSubmit={handleSubmit} id="reset-password-form">
        {error && (
          <div className="alert-error" id="reset-password-error" role="alert">
            {error}
          </div>
        )}

        <div className="form-group">
          <label className="form-label" htmlFor="reset-password-input">
            New Password
          </label>
          <div className="password-field">
            <input
              id="reset-password-input"
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
              id="reset-password-toggle"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div className="modal__footer">
          <button
            type="button"
            className="btn btn--ghost"
            id="reset-password-cancel"
            onClick={handleClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button type="submit" className="btn" id="reset-password-submit" disabled={submitting}>
            {submitting ? 'Resetting…' : 'Reset Password'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
