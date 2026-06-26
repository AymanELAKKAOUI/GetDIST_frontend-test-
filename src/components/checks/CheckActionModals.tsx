import { useState, type FormEvent } from 'react';
import { Modal } from '../ui/Modal';
import { ConfirmDialog } from '../ui/ConfirmDialog';

interface IssueCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (checkNumber?: string) => Promise<void>;
  submitting?: boolean;
}

export function IssueCheckModal({ isOpen, onClose, onSubmit, submitting = false }: IssueCheckModalProps) {
  const [checkNumber, setCheckNumber] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await onSubmit(checkNumber.trim() || undefined);
    setCheckNumber('');
  };

  const handleClose = () => {
    setCheckNumber('');
    onClose();
  };

  return (
    <Modal id="issue-check-modal" title="Issue Check" isOpen={isOpen} onClose={handleClose} maxWidth={480}>
      <form className="pay-form-grid" onSubmit={handleSubmit}>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>
          Mark this check as issued. You can optionally assign a check number now.
        </p>
        <div className="pay-form-row pay-form-row--stacked">
          <label className="pay-form-row__label" htmlFor="issue-check-number">
            Check Number (optional)
          </label>
          <input
            id="issue-check-number"
            className="form-input"
            value={checkNumber}
            onChange={(e) => setCheckNumber(e.target.value)}
            placeholder="e.g. CH-1002"
          />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <button type="button" className="btn btn--ghost btn--sm" onClick={handleClose} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="btn btn--sm" disabled={submitting}>
            Issue Check
          </button>
        </div>
      </form>
    </Modal>
  );
}

interface DateCheckModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  fieldLabel: string;
  submitLabel: string;
  onClose: () => void;
  onSubmit: (date?: string) => Promise<void>;
  submitting?: boolean;
}

export function DateCheckModal({
  isOpen,
  title,
  description,
  fieldLabel,
  submitLabel,
  onClose,
  onSubmit,
  submitting = false,
}: DateCheckModalProps) {
  const [date, setDate] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await onSubmit(date || undefined);
    setDate('');
  };

  const handleClose = () => {
    setDate('');
    onClose();
  };

  return (
    <Modal id="date-check-modal" title={title} isOpen={isOpen} onClose={handleClose} maxWidth={480}>
      <form className="pay-form-grid" onSubmit={handleSubmit}>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>{description}</p>
        <div className="pay-form-row pay-form-row--stacked">
          <label className="pay-form-row__label" htmlFor="check-action-date">
            {fieldLabel} (optional)
          </label>
          <input
            id="check-action-date"
            type="date"
            className="form-input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <button type="button" className="btn btn--ghost btn--sm" onClick={handleClose} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="btn btn--sm" disabled={submitting}>
            {submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}

interface CancelCheckDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  submitting?: boolean;
}

export function CancelCheckDialog({ isOpen, onClose, onConfirm, submitting = false }: CancelCheckDialogProps) {
  return (
    <ConfirmDialog
      id="cancel-check-dialog"
      isOpen={isOpen}
      title="Cancel Check"
      message="This check will be marked as cancelled. This action cannot be undone."
      confirmLabel="Cancel Check"
      destructive
      isLoading={submitting}
      onCancel={onClose}
      onConfirm={onConfirm}
    />
  );
}
