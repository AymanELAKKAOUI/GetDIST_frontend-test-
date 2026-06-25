import { useEffect, useState, type FormEvent } from 'react';
import { getApiErrorMessage } from '../../api/client';
import { Modal } from '../ui/Modal';

interface DeclinePurchaseOrderModalProps {
  isOpen: boolean;
  poNumber: string;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}

export function DeclinePurchaseOrderModal({
  isOpen,
  poNumber,
  onClose,
  onConfirm,
}: DeclinePurchaseOrderModalProps) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setReason('');
      setError(null);
      setSubmitting(false);
    }
  }, [isOpen]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Please provide a reason for declining.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(reason.trim());
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to decline purchase order.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      id="decline-po-modal"
      title="Decline Purchase Order"
      isOpen={isOpen}
      onClose={onClose}
      maxWidth={480}
    >
      <form onSubmit={handleSubmit}>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>
          You are declining purchase order <strong>{poNumber}</strong>. Please provide a reason.
        </p>
        {error && (
          <div className="alert-error" role="alert">
            {error}
          </div>
        )}
        <div className="form-group">
          <label className="form-label" htmlFor="decline-reason">
            Reason
          </label>
          <textarea
            id="decline-reason"
            className="form-textarea"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            rows={4}
          />
        </div>
        <div className="modal__footer" style={{ padding: '16px 0 0', borderTop: '1px solid var(--border-soft)' }}>
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="btn btn--destructive" disabled={submitting}>
            {submitting ? 'Declining…' : 'Decline Order'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
