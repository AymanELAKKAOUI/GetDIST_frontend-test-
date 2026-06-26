import { useEffect, useState, type FormEvent } from 'react';
import { getApiErrorMessage } from '../../api/client';
import { Modal } from '../ui/Modal';

interface ApproveApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (comment: string) => Promise<void>;
}

export function ApproveApprovalModal({ isOpen, onClose, onConfirm }: ApproveApprovalModalProps) {
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setComment('');
      setError(null);
      setSubmitting(false);
    }
  }, [isOpen]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(comment.trim());
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to approve proposal.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal id="approve-approval-modal" title="Approve Proposal" isOpen={isOpen} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        {error && (
          <div className="alert-error" role="alert">
            {error}
          </div>
        )}
        <div className="form-group">
          <label className="form-label" htmlFor="approve-comment">
            Comment (optional)
          </label>
          <textarea
            id="approve-comment"
            className="form-textarea"
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add an optional approval comment…"
          />
        </div>
        <div className="modal__footer" style={{ paddingTop: 16, borderTop: '1px solid var(--border-soft)' }}>
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="btn" disabled={submitting}>
            {submitting ? 'Approving…' : 'Approve'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

interface RejectApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}

export function RejectApprovalModal({ isOpen, onClose, onConfirm }: RejectApprovalModalProps) {
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
      setError('Rejection reason is required.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(reason.trim());
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to reject proposal.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal id="reject-approval-modal" title="Reject Proposal" isOpen={isOpen} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        {error && (
          <div className="alert-error" role="alert">
            {error}
          </div>
        )}
        <div className="form-group">
          <label className="form-label" htmlFor="reject-reason">
            Reason
          </label>
          <textarea
            id="reject-reason"
            className="form-textarea"
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            placeholder="Explain why this proposal is rejected…"
          />
        </div>
        <div className="modal__footer" style={{ paddingTop: 16, borderTop: '1px solid var(--border-soft)' }}>
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="btn btn--destructive" disabled={submitting}>
            {submitting ? 'Rejecting…' : 'Reject'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
