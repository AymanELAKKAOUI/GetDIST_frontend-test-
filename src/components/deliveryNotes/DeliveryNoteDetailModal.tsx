import { Modal } from '../ui/Modal';
import { DeliveryNoteStatusBadge } from './DeliveryNoteStatusBadge';
import {
  formatDateDisplay,
  normalizeSections,
  type DeliveryNote,
} from '../../types/deliveryNote';
import './DeliveryNotes.css';

interface DeliveryNoteDetailModalProps {
  isOpen: boolean;
  note: DeliveryNote | null;
  supplierName: string;
  purchaseOrderNumber: string | null;
  onClose: () => void;
}

export function DeliveryNoteDetailModal({
  isOpen,
  note,
  supplierName,
  purchaseOrderNumber,
  onClose,
}: DeliveryNoteDetailModalProps) {
  if (!note) return null;

  const sections = normalizeSections(note.lineItems);

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

      <div className="modal__footer" style={{ paddingTop: 16, borderTop: '1px solid var(--border-soft)' }}>
        <button type="button" className="btn btn--ghost" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
}
