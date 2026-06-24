import { useState, type FormEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { apiClient, getApiErrorMessage } from '../../api/client';
import { Modal } from '../ui/Modal';
import '../users/UserFormModal.css';

interface ProvisionPortalUserModalProps {
  isOpen: boolean;
  supplierId: string | null;
  supplierName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function ProvisionPortalUserModal({
  isOpen,
  supplierId,
  supplierName,
  onClose,
  onSuccess,
}: ProvisionPortalUserModalProps) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setEmail('');
    setFullName('');
    setPassword('');
    setShowPassword(false);
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!supplierId) return;

    setError(null);
    setSubmitting(true);

    try {
      await apiClient.post(`/api/suppliers/${supplierId}/create-user`, {
        email: email.trim(),
        fullName: fullName.trim(),
        password,
      });
      onSuccess();
      handleClose();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to create portal user.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      id="provision-portal-user-modal"
      title={`Provision Portal User for ${supplierName}`}
      isOpen={isOpen}
      onClose={handleClose}
    >
      <form onSubmit={handleSubmit} id="provision-portal-user-form">
        {error && (
          <div className="alert-error" id="provision-portal-error" role="alert">
            {error}
          </div>
        )}

        <div className="form-group">
          <label className="form-label" htmlFor="portal-user-email">Email</label>
          <input
            id="portal-user-email"
            type="email"
            className="form-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="portal-user-full-name">Full Name</label>
          <input
            id="portal-user-full-name"
            className="form-input"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            maxLength={255}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="portal-user-password">Password</label>
          <div className="password-field">
            <input
              id="portal-user-password"
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
              id="portal-user-password-toggle"
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
            id="provision-portal-cancel"
            onClick={handleClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button type="submit" className="btn" id="provision-portal-submit" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create Portal User'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
