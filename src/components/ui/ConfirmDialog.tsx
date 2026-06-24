import { Modal } from './Modal';
import './ConfirmDialog.css';

interface ConfirmDialogProps {
  id: string;
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  isLoading?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  id,
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  isLoading = false,
  error = null,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal id={id} title={title} isOpen={isOpen} onClose={onCancel} maxWidth={480}>
      <div className={`confirm-dialog ${destructive ? 'confirm-dialog--destructive' : ''}`}>
        <p className="confirm-dialog__message">{message}</p>
        {error && (
          <div className="alert-error" id={`${id}-error`}>
            {error}
          </div>
        )}
        <div className="modal__footer">
          <button
            type="button"
            className="btn btn--ghost"
            id={`${id}-cancel`}
            onClick={onCancel}
            disabled={isLoading}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn ${destructive ? 'btn--destructive' : ''}`}
            id={`${id}-confirm`}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? 'Processing…' : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
