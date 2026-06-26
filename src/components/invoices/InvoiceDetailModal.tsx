import { Download, CreditCard } from 'lucide-react';
import { Link } from 'react-router-dom';
import { downloadInvoicePdf } from '../../api/invoices';
import {
  formatDateDisplay,
  formatMoney,
  type Invoice,
} from '../../types/invoice';
import type { Payment, PaymentStatus } from '../../types/payment';
import { statusDisplayLabel as paymentStatusLabel } from '../../types/payment';
import { Modal } from '../ui/Modal';
import { useToast } from '../ui/Toast';
import { InvoiceStatusBadge } from './InvoiceStatusBadge';
import './Invoices.css';
import '../deliveryNotes/DeliveryNotes.css';

interface InvoiceDetailModalProps {
  isOpen: boolean;
  invoice: Invoice | null;
  supplierName?: string;
  deliveryNoteNumber?: string | null;
  purchaseOrderNumber?: string | null;
  showApprove?: boolean;
  approving?: boolean;
  onApprove?: () => void;
  linkedPayment?: Payment | null;
  canCreatePayment?: boolean;
  onCreatePayment?: () => void;
  onClose: () => void;
}

export function InvoiceDetailModal({
  isOpen,
  invoice,
  supplierName,
  deliveryNoteNumber,
  purchaseOrderNumber,
  showApprove = false,
  approving = false,
  onApprove,
  linkedPayment = null,
  canCreatePayment = false,
  onCreatePayment,
  onClose,
}: InvoiceDetailModalProps) {
  const { showToast } = useToast();

  if (!invoice) return null;

  const isApproved = invoice.status === 'approved' || invoice.status === 'partially_paid' || invoice.status === 'paid';
  const showPendingMessage = !isApproved;

  const handleDownload = async () => {
    if (!invoice.originalFilename) {
      showToast('No PDF file available.', 'error');
      return;
    }
    try {
      await downloadInvoicePdf(invoice.id, invoice.originalFilename);
    } catch {
      showToast('Failed to download PDF.', 'error');
    }
  };

  return (
    <Modal
      id="invoice-detail-modal"
      title="Invoice Details"
      isOpen={isOpen}
      onClose={onClose}
      maxWidth={720}
    >
      <div className="dn-form-grid">
        <div className="dn-form-row">
          <span className="dn-form-row__label">Invoice Number</span>
          <span>{invoice.invoiceNumber ?? 'Pending'}</span>
        </div>
        {supplierName && (
          <div className="dn-form-row">
            <span className="dn-form-row__label">Supplier</span>
            <span>{supplierName}</span>
          </div>
        )}
        <div className="dn-form-row">
          <span className="dn-form-row__label">File</span>
          <span>{invoice.originalFilename ?? '—'}</span>
        </div>
        <div className="dn-form-row">
          <span className="dn-form-row__label">BL Reference</span>
          <span>{deliveryNoteNumber ?? '—'}</span>
        </div>
        <div className="dn-form-row">
          <span className="dn-form-row__label">PO Reference</span>
          <span>{purchaseOrderNumber ?? '—'}</span>
        </div>
        <div className="dn-form-row">
          <span className="dn-form-row__label">Status</span>
          <span>
            <InvoiceStatusBadge status={invoice.status} />
          </span>
        </div>
        {invoice.declineReason && (
          <div className="dn-rejection-banner" style={{ gridColumn: '1 / -1' }}>
            Rejection reason: {invoice.declineReason}
          </div>
        )}
      </div>

      {showPendingMessage && (
        <div className="dn-rejection-banner" style={{ marginTop: 16, background: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.3)', color: '#fcd34d' }}>
          Pending company review — the company will verify this invoice before it is accepted.
        </div>
      )}

      {isApproved && invoice.lineItems.length > 0 && (
        <>
          <h3 style={{ fontSize: 14, fontWeight: 600, margin: '20px 0 10px' }}>Line Items</h3>
          <div className="table-card">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Qty</th>
                  <th>Unit Price</th>
                  <th>Tax %</th>
                </tr>
              </thead>
              <tbody>
                {invoice.lineItems.map((item, index) => (
                  <tr key={index}>
                    <td>{item.productName}</td>
                    <td>{item.quantity}</td>
                    <td>{formatMoney(item.unitPrice, invoice.currency)}</td>
                    <td>{item.taxRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="inv-totals-panel">
            <div className="inv-totals-row">
              <span>Subtotal</span>
              <span>{formatMoney(invoice.subtotalAmount, invoice.currency)}</span>
            </div>
            <div className="inv-totals-row">
              <span>Tax</span>
              <span>{formatMoney(invoice.taxAmount, invoice.currency)}</span>
            </div>
            <div className="inv-totals-row inv-totals-row--grand">
              <span>Total</span>
              <span>{formatMoney(invoice.totalAmount, invoice.currency)}</span>
            </div>
          </div>

          <div className="dn-form-grid" style={{ marginTop: 16 }}>
            <div className="dn-form-row">
              <span className="dn-form-row__label">Invoice Date</span>
              <span>{formatDateDisplay(invoice.invoiceDate)}</span>
            </div>
            <div className="dn-form-row">
              <span className="dn-form-row__label">Due Date</span>
              <span>{formatDateDisplay(invoice.dueDate)}</span>
            </div>
          </div>
        </>
      )}

      {invoice.status === 'pending_verification' && invoice.lineItems.length > 0 && (
        <>
          <h3 style={{ fontSize: 14, fontWeight: 600, margin: '20px 0 10px' }}>Pre-filled Line Items</h3>
          <div className="table-card">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Qty</th>
                  <th>Unit Price</th>
                  <th>Tax %</th>
                </tr>
              </thead>
              <tbody>
                {invoice.lineItems.map((item, index) => (
                  <tr key={index}>
                    <td>{item.productName}</td>
                    <td>{item.quantity}</td>
                    <td>{formatMoney(item.unitPrice, invoice.currency)}</td>
                    <td>{item.taxRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="inv-totals-panel">
            <div className="inv-totals-row inv-totals-row--grand">
              <span>Total</span>
              <span>{formatMoney(invoice.totalAmount, invoice.currency)}</span>
            </div>
          </div>
        </>
      )}

      <div className="inv-detail-actions">
        <button type="button" className="btn btn--ghost btn--sm" onClick={handleDownload}>
          <Download size={14} />
          Download PDF
        </button>
        {canCreatePayment && onCreatePayment && (
          <button type="button" className="btn btn--sm" onClick={onCreatePayment}>
            <CreditCard size={14} />
            Pay Invoice
          </button>
        )}
        {linkedPayment && (
          <Link to={`/payments/${linkedPayment.id}`} className="inv-sent-link" onClick={onClose}>
            View linked payment ({paymentStatusLabel(linkedPayment.status as PaymentStatus)})
          </Link>
        )}
        {showApprove && onApprove && (
          <button type="button" className="btn btn--sm" onClick={onApprove} disabled={approving}>
            {approving ? 'Approving…' : 'Approve Invoice'}
          </button>
        )}
        <button type="button" className="btn btn--ghost btn--sm" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
}
