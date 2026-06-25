import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import { ArrowLeft, ArrowRight, Calendar, CheckCircle2, FileUp } from 'lucide-react';
import { apiClient, getApiErrorMessage } from '../../api/client';
import { uploadDeliveryNotePdf } from '../../api/deliveryNotes';
import {
  formatDateDisplay,
  normalizePurchaseOrder,
  todayIsoDate,
  type PurchaseOrder,
} from '../../types/purchaseOrder';
import { Modal } from '../ui/Modal';
import { Spinner } from '../ui/Spinner';
import { useToast } from '../ui/Toast';
import '../purchaseOrders/PurchaseOrders.css';
import './DeliveryNotes.css';

const MAX_FILE_SIZE = 25 * 1024 * 1024;

interface UploadDeliveryNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  purchaseOrder?: PurchaseOrder;
}

function isPdfFile(file: File): boolean {
  if (file.type === 'application/pdf') return true;
  return file.name.toLowerCase().endsWith('.pdf');
}

export function UploadDeliveryNoteModal({
  isOpen,
  onClose,
  onSuccess,
  purchaseOrder: fixedPurchaseOrder,
}: UploadDeliveryNoteModalProps) {
  const { showToast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<1 | 2>(fixedPurchaseOrder ? 2 : 1);
  const [acceptedOrders, setAcceptedOrders] = useState<PurchaseOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [selectedPoId, setSelectedPoId] = useState('');
  const [reference, setReference] = useState('');
  const [deliveryDate, setDeliveryDate] = useState(todayIsoDate());

  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const selectedPo =
    fixedPurchaseOrder ??
    acceptedOrders.find((po) => po.id === selectedPoId) ??
    null;

  const reset = useCallback(() => {
    setStep(fixedPurchaseOrder ? 2 : 1);
    setAcceptedOrders([]);
    setLoadingOrders(false);
    setSelectedPoId(fixedPurchaseOrder?.id ?? '');
    setReference('');
    setDeliveryDate(todayIsoDate());
    setDragging(false);
    setUploading(false);
    setProgress(0);
    setError(null);
    setSuccess(false);
  }, [fixedPurchaseOrder]);

  useEffect(() => {
    if (!isOpen) return;
    reset();

    if (!fixedPurchaseOrder) {
      setLoadingOrders(true);
      apiClient
        .get<{ purchaseOrders: PurchaseOrder[] }>('/api/purchase-orders', {
          params: { status: 'accepted', limit: 100, offset: 0 },
        })
        .then(({ data }) => {
          const orders = data.purchaseOrders.map(normalizePurchaseOrder);
          setAcceptedOrders(orders);
          if (orders.length === 1) {
            setSelectedPoId(orders[0].id);
          }
        })
        .catch(() => {
          setError('Failed to load accepted purchase orders.');
        })
        .finally(() => setLoadingOrders(false));
    }
  }, [isOpen, fixedPurchaseOrder, reset]);

  const handleClose = () => {
    reset();
    onClose();
  };

  const validateStep1 = () => {
    if (!selectedPoId) {
      setError('Please select a purchase order.');
      return false;
    }
    if (!deliveryDate) {
      setError('Delivery date is required.');
      return false;
    }
    setError(null);
    return true;
  };

  const validateFile = (file: File): string | null => {
    if (!isPdfFile(file)) return 'Only PDF files are allowed.';
    if (file.size > MAX_FILE_SIZE) return 'File must be 25 MB or smaller.';
    return null;
  };

  const handleFile = async (file: File) => {
    if (!selectedPo) {
      setError('Please select a purchase order first.');
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
      await uploadDeliveryNotePdf(selectedPo.id, file, setProgress);
      setSuccess(true);
      showToast('Delivery note PDF uploaded. Awaiting company verification.');
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

  return (
    <Modal
      id="upload-delivery-note-modal"
      title="New Delivery Note"
      isOpen={isOpen}
      onClose={handleClose}
      maxWidth={720}
      className="modal--dn-upload"
    >
      {success ? (
        <div className="dn-upload-success" id="upload-bl-success">
          <CheckCircle2 size={48} color="#4ade80" />
          <h3 className="dn-upload-success__title">Upload successful</h3>
          <p className="dn-upload-success__message">
            Your delivery note PDF for purchase order{' '}
            <strong>{selectedPo?.purchaseOrderNumber}</strong> is awaiting company verification.
          </p>
          <button type="button" className="btn btn--ghost" onClick={handleClose}>
            Close
          </button>
        </div>
      ) : (
        <div className="dn-upload-wizard">
          <div className="po-wizard__step-label">Step {step} / 2</div>

          {error && (
            <div className="alert-error" role="alert">
              {error}
            </div>
          )}

          {step === 1 && !fixedPurchaseOrder ? (
            <div className="po-form-grid">
              <div className="po-form-row po-form-row--stacked po-form-row--field-block">
                <label className="po-form-row__label" htmlFor="dn-po-select">
                  Purchase Order
                </label>
                <div>
                  {loadingOrders ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}>
                      <Spinner size={18} />
                      <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                        Loading accepted orders…
                      </span>
                    </div>
                  ) : acceptedOrders.length === 0 ? (
                    <p className="po-form-hint">
                      No accepted purchase orders yet. Accept a PO first, then return here to send
                      your delivery note PDF.
                    </p>
                  ) : (
                    <select
                      id="dn-po-select"
                      className="form-select"
                      value={selectedPoId}
                      onChange={(e) => setSelectedPoId(e.target.value)}
                    >
                      <option value="">Select a purchase order</option>
                      {acceptedOrders.map((po) => (
                        <option key={po.id} value={po.id}>
                          {po.purchaseOrderNumber} — {formatDateDisplay(po.orderDate)}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div className="po-form-row">
                <label className="po-form-row__label" htmlFor="dn-reference">
                  Reference
                </label>
                <input
                  id="dn-reference"
                  className="form-input"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Internal reference (optional)"
                />
              </div>

              <div className="po-form-row">
                <label className="po-form-row__label" htmlFor="dn-delivery-date">
                  Delivery Date
                </label>
                <div className="po-form-row__date">
                  <input
                    id="dn-delivery-date"
                    type="date"
                    className="form-input"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    required
                  />
                  <Calendar size={16} className="po-form-row__date-icon" aria-hidden="true" />
                </div>
              </div>

              <p className="po-form-hint">
                On the next step you will attach the BL PDF. The company will enter the official BL
                number and line details when verifying.
              </p>
            </div>
          ) : (
            <>
              <p className="po-form-hint" style={{ marginBottom: 16 }}>
                Uploading for purchase order{' '}
                <strong>{selectedPo?.purchaseOrderNumber ?? '—'}</strong>
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
                <div className="dn-upload-zone__title">Drop your BL PDF here</div>
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
            </>
          )}

          <div className="po-wizard__footer">
            {step === 2 && !fixedPurchaseOrder ? (
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => {
                  setStep(1);
                  setError(null);
                }}
                disabled={uploading}
              >
                <ArrowLeft size={16} />
                Previous
              </button>
            ) : (
              <span />
            )}
            <div className="po-wizard__footer-right">
              <button type="button" className="btn btn--ghost" onClick={handleClose} disabled={uploading}>
                Cancel
              </button>
              {step === 1 && !fixedPurchaseOrder ? (
                <button
                  type="button"
                  className="btn"
                  disabled={loadingOrders || acceptedOrders.length === 0}
                  onClick={() => validateStep1() && setStep(2)}
                >
                  Next
                  <ArrowRight size={16} />
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
