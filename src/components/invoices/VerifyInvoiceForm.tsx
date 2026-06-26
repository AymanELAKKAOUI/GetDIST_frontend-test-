import { useMemo, useState, type FormEvent } from 'react';
import { Calendar, Plus, X } from 'lucide-react';
import { apiClient, getApiErrorMessage } from '../../api/client';
import {
  calculateInvoiceTotals,
  calculateLineTotal,
  emptyLineItem,
  todayIsoDate,
  formatMoney,
  type Invoice,
  type InvoiceLineItem,
} from '../../types/invoice';
import { useToast } from '../ui/Toast';
import '../deliveryNotes/DeliveryNotes.css';
import './Invoices.css';

interface VerifyInvoiceFormProps {
  invoice: Invoice;
  purchaseOrderTotal: number | null;
  onSuccess: () => void;
}

export function VerifyInvoiceForm({ invoice, purchaseOrderTotal, onSuccess }: VerifyInvoiceFormProps) {
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(todayIsoDate());
  const [dueDate, setDueDate] = useState(todayIsoDate());
  const [receptionDate, setReceptionDate] = useState(todayIsoDate());
  const [currency, setCurrency] = useState(invoice.currency || 'MAD');
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([emptyLineItem()]);

  const totals = useMemo(() => calculateInvoiceTotals(lineItems), [lineItems]);

  const updateLine = (index: number, patch: Partial<InvoiceLineItem>) => {
    setLineItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!invoiceNumber.trim()) {
      setError('Invoice number is required.');
      return;
    }
    if (!invoiceDate || !dueDate) {
      setError('Invoice date and due date are required.');
      return;
    }
    if (dueDate < invoiceDate) {
      setError('Due date must be on or after invoice date.');
      return;
    }

    const validItems = lineItems.filter(
      (item) => item.productName.trim() && item.quantity > 0 && item.unitPrice >= 0,
    );
    if (validItems.length === 0) {
      setError('Add at least one line item with product, quantity, and unit price.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await apiClient.post(`/api/invoices/${invoice.id}/verify`, {
        invoiceNumber: invoiceNumber.trim(),
        invoiceDate,
        dueDate,
        receptionDate: receptionDate || invoiceDate,
        currency: currency.toUpperCase(),
        lineItems: validItems.map((item) => ({
          productName: item.productName.trim(),
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate,
        })),
      });
      showToast('Invoice verified and approved.');
      onSuccess();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to verify invoice.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="dn-wizard" onSubmit={handleSubmit}>
      {error && (
        <div className="alert-error" role="alert">
          {error}
        </div>
      )}

      {purchaseOrderTotal != null && (
        <div className="inv-po-hint">
          PO total reference: <strong>{formatMoney(purchaseOrderTotal, currency)}</strong> — invoice
          subtotal must match this amount (within 0.01 {currency}).
        </div>
      )}

      <div className="dn-form-grid">
        <div className="dn-form-row">
          <label className="dn-form-row__label" htmlFor="verify-inv-number">
            Invoice Number
          </label>
          <input
            id="verify-inv-number"
            className="form-input"
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
            required
          />
        </div>
        <div className="dn-form-row">
          <label className="dn-form-row__label" htmlFor="verify-inv-date">
            Invoice Date
          </label>
          <div style={{ position: 'relative' }}>
            <input
              id="verify-inv-date"
              type="date"
              className="form-input"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              required
            />
            <Calendar
              size={16}
              style={{
                position: 'absolute',
                right: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
                pointerEvents: 'none',
              }}
            />
          </div>
        </div>
        <div className="dn-form-row">
          <label className="dn-form-row__label" htmlFor="verify-inv-due">
            Due Date
          </label>
          <input
            id="verify-inv-due"
            type="date"
            className="form-input"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            required
          />
        </div>
        <div className="dn-form-row">
          <label className="dn-form-row__label" htmlFor="verify-inv-reception">
            Reception Date
          </label>
          <input
            id="verify-inv-reception"
            type="date"
            className="form-input"
            value={receptionDate}
            onChange={(e) => setReceptionDate(e.target.value)}
          />
        </div>
        <div className="dn-form-row">
          <label className="dn-form-row__label" htmlFor="verify-inv-currency">
            Currency
          </label>
          <input
            id="verify-inv-currency"
            className="form-input"
            value={currency}
            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            maxLength={3}
            required
          />
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span className="dn-form-row__label">Line Items</span>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => setLineItems((prev) => [...prev, emptyLineItem()])}
          >
            <Plus size={16} />
            Add line
          </button>
        </div>

        <div className="table-card" style={{ overflowX: 'auto' }}>
          <table className="dn-lines-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th>Tax %</th>
                <th>Line Total</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item, index) => (
                <tr key={index}>
                  <td>
                    <input
                      className="form-input"
                      value={item.productName}
                      onChange={(e) => updateLine(index, { productName: e.target.value })}
                      placeholder="Product name"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      className="form-input"
                      min={0.01}
                      step="any"
                      value={item.quantity}
                      onChange={(e) => updateLine(index, { quantity: Number(e.target.value) })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      className="form-input"
                      min={0}
                      step="any"
                      value={item.unitPrice}
                      onChange={(e) => updateLine(index, { unitPrice: Number(e.target.value) })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      className="form-input"
                      min={0}
                      max={100}
                      step="any"
                      value={item.taxRate}
                      onChange={(e) => updateLine(index, { taxRate: Number(e.target.value) })}
                    />
                  </td>
                  <td>
                    <span className="inv-line-total">{formatMoney(calculateLineTotal(item), currency)}</span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="po-line-remove"
                      onClick={() =>
                        setLineItems((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)))
                      }
                      aria-label="Remove line"
                    >
                      <X size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="inv-totals-panel">
          <div className="inv-totals-row">
            <span>Subtotal (excl. tax)</span>
            <span>{formatMoney(totals.subtotal, currency)}</span>
          </div>
          <div className="inv-totals-row">
            <span>Tax Amount</span>
            <span>{formatMoney(totals.taxAmount, currency)}</span>
          </div>
          <div className="inv-totals-row inv-totals-row--grand">
            <span>Grand Total</span>
            <span>{formatMoney(totals.total, currency)}</span>
          </div>
        </div>
      </div>

      <div className="dn-wizard__footer">
        <span />
        <button type="submit" className="btn" disabled={submitting}>
          {submitting ? 'Verifying…' : 'Verify & Accept'}
        </button>
      </div>
    </form>
  );
}
