import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import { CheckCircle2, FileUp } from 'lucide-react';
import { getApiErrorMessage } from '../../api/client';
import { uploadInvoicePdf } from '../../api/invoices';
import type { DeliveryNote } from '../../types/deliveryNote';
import { Modal } from '../ui/Modal';
import { useToast } from '../ui/Toast';
import '../deliveryNotes/DeliveryNotes.css';

const MAX_FILE_SIZE = 25 * 1024 * 1024;

interface UploadInvoiceModalProps {
  isOpen: boolean;
  deliveryNote: DeliveryNote | null;
  isResend?: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

function isPdfFile(file: File): boolean {
  if (file.type === 'application/pdf') return true;
  return file.name.toLowerCase().endsWith('.pdf');
}

export function UploadInvoiceModal({
  isOpen,
  deliveryNote,
  isResend = false,
  onClose,
  onSuccess,
}: UploadInvoiceModalProps) {
  const { showToast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const reset = useCallback(() => {
    setDragging(false);
    setUploading(false);
    setProgress(0);
    setError(null);
    setSuccess(false);
  }, []);

  useEffect(() => {
    if (isOpen) reset();
  }, [isOpen, reset]);

  const handleClose = () => {
    reset();
    onClose();
  };

  const validateFile = (file: File): string | null => {
    if (!isPdfFile(file)) return 'Only PDF files are allowed.';
    if (file.size > MAX_FILE_SIZE) return 'File must be 25 MB or smaller.';
    return null;
  };

  const handleFile = async (file: File) => {
    if (!deliveryNote) {
      setError('Delivery note is required.');
      return;
    }

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setUploading(true);
    setError(null);
    setProgress(0);

    try {
      await uploadInvoicePdf(deliveryNote.id, file, setProgress);
      setSuccess(true);
      showToast('Invoice PDF uploaded. Awaiting company verification.');
      onSuccess?.();
    } catch (err) {
      const message = getApiErrorMessage(err, 'Upload failed.');
      setError(message);
      showToast(message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
  };

  const blLabel = deliveryNote?.deliveryNoteNumber ?? deliveryNote?.originalFilename ?? 'Delivery Note';

  return (
    <Modal
      id="upload-invoice-modal"
      title={isResend ? 'Re-send Invoice' : 'Send Invoice'}
      isOpen={isOpen}
      onClose={handleClose}
      maxWidth={640}
      className="modal--dn-upload"
    >
      {success ? (
        <div className="dn-upload-success" id="upload-invoice-success">
          <CheckCircle2 size={48} color="#4ade80" />
          <h3 className="dn-upload-success__title">Upload successful</h3>
          <p className="dn-upload-success__message">
            Your invoice PDF for delivery note <strong>{blLabel}</strong> is awaiting company
            verification.
          </p>
          <button type="button" className="btn btn--ghost" onClick={handleClose}>
            Close
          </button>
        </div>
      ) : (
        <div className="dn-upload-wizard">
          {error && (
            <div className="alert-error" role="alert">
              {error}
            </div>
          )}

          <p className="po-form-hint" style={{ marginBottom: 16 }}>
            Uploading invoice for verified delivery note <strong>{blLabel}</strong>
          </p>

          <div
            className={`dn-upload-zone dn-upload-zone--large ${dragging ? 'dn-upload-zone--dragging' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => !uploading && inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
            }}
          >
            <FileUp size={40} color="var(--accent)" style={{ marginBottom: 16 }} />
            <div className="dn-upload-zone__title">Drop your invoice PDF here</div>
            <div className="dn-upload-zone__hint">or click to browse · PDF only · max 25 MB</div>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
                e.target.value = '';
              }}
            />
          </div>

          {uploading && (
            <div className="dn-upload-progress">
              <div className="dn-upload-progress__bar" style={{ width: `${progress}%` }} />
            </div>
          )}

          <div className="dn-wizard__footer">
            <span />
            <button type="button" className="btn btn--ghost" onClick={handleClose} disabled={uploading}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
