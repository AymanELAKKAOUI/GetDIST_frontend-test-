import { useEffect, useState, type FormEvent } from 'react';
import { getApiErrorMessage } from '../../api/client';
import { Modal } from '../ui/Modal';

interface DisputeInvoiceModalProps {
  isOpen: boolean;
  filename: string | null;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}

export function DisputeInvoiceModal({
  isOpen,
  filename,
  onClose,
  onConfirm,
}: DisputeInvoiceModalProps) {
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
      setError('Dispute reason is required.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(reason.trim());
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to dispute invoice.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal id="dispute-invoice-modal" title="Dispute Invoice" isOpen={isOpen} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>
          Dispute invoice{filename ? <> <strong>{filename}</strong></> : ''}. The supplier will see
          your reason.
        </p>
        {error && (
          <div className="alert-error" role="alert">
            {error}
          </div>
        )}
        <div className="form-group">
          <label className="form-label" htmlFor="dispute-invoice-reason">
            Reason
          </label>
          <textarea
            id="dispute-invoice-reason"
            className="form-textarea"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            rows={4}
            placeholder="Explain why this invoice cannot be accepted…"
          />
        </div>
        <div className="modal__footer" style={{ paddingTop: 16, borderTop: '1px solid var(--border-soft)' }}>
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="btn btn--destructive" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Dispute'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
