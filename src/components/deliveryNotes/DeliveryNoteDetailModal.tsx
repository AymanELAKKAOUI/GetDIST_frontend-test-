import { Link } from 'react-router-dom';
import { FileUp } from 'lucide-react';
import {
  findActiveInvoice,
  findRejectedInvoice,
  type Invoice,
} from '../../types/invoice';
import { Modal } from '../ui/Modal';
import { DeliveryNoteStatusBadge } from './DeliveryNoteStatusBadge';
import {
  formatDateDisplay,
  normalizeSections,
  type DeliveryNote,
} from '../../types/deliveryNote';
import './DeliveryNotes.css';
import '../invoices/Invoices.css';

interface DeliveryNoteDetailModalProps {
  isOpen: boolean;
  note: DeliveryNote | null;
  supplierName: string;
  purchaseOrderNumber: string | null;
  invoices?: Invoice[];
  canSubmitInvoice?: boolean;
  onSendInvoice?: () => void;
  onClose: () => void;
}

export function DeliveryNoteDetailModal({
  isOpen,
  note,
  supplierName,
  purchaseOrderNumber,
  invoices = [],
  canSubmitInvoice = false,
  onSendInvoice,
  onClose,
}: DeliveryNoteDetailModalProps) {
  if (!note) return null;

  const sections = normalizeSections(note.lineItems);
  const activeInvoice = findActiveInvoice(invoices);
  const rejectedInvoice = findRejectedInvoice(invoices);
  const showInvoiceUpload =
    note.status === 'verified' && canSubmitInvoice && !activeInvoice && onSendInvoice;
  const showInvoiceSentLink = note.status === 'verified' && !!activeInvoice;

  return (
    <Modal id="delivery-note-detail-modal" title="Delivery Note Details" isOpen={isOpen} onClose={onClose} maxWidth={640}>
      <div className="dn-form-grid">
        <div className="dn-form-row">
          <span className="dn-form-row__label">BL Number</span>
          <span>{note.deliveryNoteNumber ?? 'Pending'}</span>
        </div>
        {!supplierName.startsWith('—') && (
          <div className="dn-form-row">
            <span className="dn-form-row__label">Supplier</span>
            <span>{supplierName}</span>
          </div>
        )}
        <div className="dn-form-row">
          <span className="dn-form-row__label">Delivery Date</span>
          <span>{formatDateDisplay(note.deliveryDate)}</span>
        </div>
        <div className="dn-form-row">
          <span className="dn-form-row__label">Linked PO</span>
          <span>{purchaseOrderNumber ?? '—'}</span>
        </div>
        <div className="dn-form-row">
          <span className="dn-form-row__label">File</span>
          <span>{note.originalFilename ?? '—'}</span>
        </div>
        <div className="dn-form-row">
          <span className="dn-form-row__label">Status</span>
          <span>
            <DeliveryNoteStatusBadge status={note.status} />
          </span>
        </div>
        {note.declineReason && (
          <div className="dn-rejection-banner" style={{ gridColumn: '1 / -1' }}>
            Rejection reason: {note.declineReason}
          </div>
        )}
      </div>

      {note.status === 'verified' && sections.length > 0 && (
        <>
          <h3 style={{ fontSize: 14, fontWeight: 600, margin: '20px 0 10px' }}>Sections</h3>
          <div className="table-card">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {sections.map((section, index) => (
                  <tr key={index}>
                    <td>{section.titre}</td>
                    <td>{section.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {(showInvoiceUpload || showInvoiceSentLink) && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-soft)' }}>
          {showInvoiceUpload && (
            <button type="button" className="btn btn--sm" onClick={onSendInvoice}>
              <FileUp size={16} />
              {rejectedInvoice ? 'Re-send Invoice' : 'Send Invoice'}
            </button>
          )}
          {showInvoiceSentLink && activeInvoice && (
            <Link
              to="/invoices"
              state={{ openInvoiceId: activeInvoice.id }}
              className="inv-sent-link"
              onClick={onClose}
            >
              Invoice Sent (View)
            </Link>
          )}
        </div>
      )}

      <div className="modal__footer" style={{ paddingTop: 16, borderTop: '1px solid var(--border-soft)' }}>
        <button type="button" className="btn btn--ghost" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
}
