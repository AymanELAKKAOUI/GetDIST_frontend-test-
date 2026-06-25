import { useEffect, useState, type FormEvent } from 'react';
import { apiClient, getApiErrorMessage } from '../../api/client';
import type { User } from '../../types/admin';
import { Modal } from '../ui/Modal';
import '../users/UserFormModal.css';

interface PortalUserEditModalProps {
  isOpen: boolean;
  user: User | null;
  onClose: () => void;
  onSuccess: (user: User) => void;
}

export function PortalUserEditModal({ isOpen, user, onClose, onSuccess }: PortalUserEditModalProps) {
  const [fullName, setFullName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && user) {
      setFullName(user.fullName);
      setError(null);
    }
  }, [isOpen, user]);

  const handleClose = () => {
    setFullName('');
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSubmitting(true);
    setError(null);

    try {
      const { data } = await apiClient.patch<{ user: User }>(`/api/admin/users/${user.id}`, {
        fullName: fullName.trim(),
      });
      onSuccess(data.user);
      handleClose();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to update portal user.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      id="portal-user-edit-modal"
      title="Edit Portal User"
      isOpen={isOpen}
      onClose={handleClose}
    >
      <form onSubmit={handleSubmit} id="portal-user-edit-form">
        {error && (
          <div className="alert-error" role="alert">
            {error}
          </div>
        )}

        <div className="form-group">
          <label className="form-label" htmlFor="portal-user-edit-email">
            Email
          </label>
          <input
            id="portal-user-edit-email"
            className="form-input"
            value={user?.email ?? ''}
            disabled
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="portal-user-edit-name">
            Full Name
          </label>
          <input
            id="portal-user-edit-name"
            className="form-input"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            maxLength={255}
            required
          />
        </div>

        <div className="modal__footer">
          <button type="button" className="btn btn--ghost" onClick={handleClose} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="btn" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
