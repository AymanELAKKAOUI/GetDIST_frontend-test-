import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { apiClient, getApiErrorMessage } from '../../api/client';
import {
  type CreatePaymentFromInvoicePrefill,
  canCreatePaymentForInvoice,
  isInvoicePayable,
} from '../../api/invoicePayments';
import { fetchAllPayments } from '../../types/payment';
import type { Invoice } from '../../types/invoice';
import type { Supplier } from '../../types/supplier';
import type { Payment, PaymentMethod } from '../../types/payment';
import { useToast } from '../ui/Toast';
import './Payments.css';
import '../invoices/Invoices.css';

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

interface CreatePaymentLocationState {
  fromInvoice?: CreatePaymentFromInvoicePrefill;
}

export function CreatePaymentPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const fromInvoice = (location.state as CreatePaymentLocationState | null)?.fromInvoice;
  const lockedFromInvoice = !!fromInvoice?.invoiceId;

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [supplierId, setSupplierId] = useState(fromInvoice?.supplierId ?? '');
  const [amount, setAmount] = useState(fromInvoice?.amount ? String(fromInvoice.amount) : '');
  const [currency, setCurrency] = useState(fromInvoice?.currency ?? 'MAD');
  const [dueDate, setDueDate] = useState(fromInvoice?.dueDate ?? todayIsoDate());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('check');
  const [invoiceId, setInvoiceId] = useState(fromInvoice?.invoiceId ?? '');
  const [scheduledDate, setScheduledDate] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [description, setDescription] = useState(fromInvoice?.description ?? '');
  const [externalReference, setExternalReference] = useState('');
  const [bankReference, setBankReference] = useState('');

  useEffect(() => {
    Promise.all([
      apiClient.get<{ suppliers: Supplier[] }>('/api/suppliers', { params: { status: 'active' } }),
      apiClient.get<{ invoices: Invoice[] }>('/api/invoices', { params: { limit: 100, offset: 0 } }),
      fetchAllPayments(async (offset, limit) => {
        const { data } = await apiClient.get<{ payments: Payment[] }>('/api/payments', {
          params: { limit, offset },
        });
        return data.payments;
      }),
    ])
      .then(([suppliersRes, invoicesRes, paymentList]) => {
        setSuppliers(suppliersRes.data.suppliers);
        setInvoices(invoicesRes.data.invoices);
        setPayments(paymentList);
      })
      .catch(() => showToast('Failed to load form references.', 'error'))
      .finally(() => setLoadingRefs(false));
  }, [showToast]);

  const payableInvoices = useMemo(
    () => invoices.filter((invoice) => canCreatePaymentForInvoice(invoice, payments)),
    [invoices, payments],
  );

  const supplierInvoices = useMemo(() => {
    if (!supplierId) return [];
    return payableInvoices.filter((invoice) => invoice.supplierId === supplierId);
  }, [payableInvoices, supplierId]);

  useEffect(() => {
    if (lockedFromInvoice || !invoiceId) return;
    const invoice = payableInvoices.find((item) => item.id === invoiceId);
    if (!invoice) return;
    setAmount(String(invoice.totalAmount ?? ''));
    setCurrency(invoice.currency);
    setDueDate(invoice.dueDate);
    if (!description.trim()) {
      const label = invoice.invoiceNumber ?? invoice.originalFilename ?? invoice.id.slice(0, 8);
      setDescription(`Payment for invoice ${label}`);
    }
  }, [invoiceId, payableInvoices, lockedFromInvoice, description]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedAmount = Number(amount);
    if (!supplierId) {
      setError('Supplier is required.');
      return;
    }
    if (!parsedAmount || parsedAmount <= 0) {
      setError('Amount must be greater than zero.');
      return;
    }
    if (!dueDate) {
      setError('Due date is required.');
      return;
    }
    if (lockedFromInvoice && !invoiceId) {
      setError('A linked invoice is required when paying from an accepted invoice.');
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await apiClient.post<{ id: string }>('/api/payments', {
        supplierId,
        amount: parsedAmount,
        currency: currency.toUpperCase(),
        dueDate,
        paymentMethod,
        ...(invoiceId ? { invoiceId } : {}),
        ...(scheduledDate ? { scheduledDate } : {}),
        ...(deliveryDate ? { deliveryDate } : {}),
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(externalReference.trim() ? { externalReference: externalReference.trim() } : {}),
        ...(bankReference.trim() ? { bankReference: bankReference.trim() } : {}),
      });
      showToast('Payment created and linked to invoice.');
      navigate(`/payments/${data.id}`, { replace: true, state: {} });
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to create payment.'));
    } finally {
      setSubmitting(false);
    }
  };

  const selectedInvoice = invoices.find((item) => item.id === invoiceId);

  return (
    <div id="create-payment-page">
      <button type="button" className="po-detail-back" onClick={() => navigate('/payments')}>
        <ArrowLeft size={16} />
        Back to payments
      </button>

      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="page-header__title">
            {lockedFromInvoice ? 'Pay Invoice' : 'New Payment'}
          </h1>
          <p className="page-header__subtitle">
            {lockedFromInvoice
              ? `Create a draft payment linked to invoice ${fromInvoice?.invoiceNumber ?? fromInvoice?.invoiceId?.slice(0, 8)}.`
              : 'Create a draft payment for evaluation and scheduling.'}
          </p>
        </div>
      </div>

      <div className="pay-panel" style={{ maxWidth: 720 }}>
        {lockedFromInvoice && (
          <div className="pay-approval-warning" style={{ marginBottom: 16, color: '#fcd34d' }}>
            This payment will be linked to the accepted invoice. After creation, evaluate and mark
            paid to update the invoice status.
          </div>
        )}

        {error && (
          <div className="alert-error" role="alert" style={{ marginBottom: 16 }}>
            {error}
          </div>
        )}

        <form className="pay-form-grid" onSubmit={handleSubmit}>
          <div className="pay-form-row pay-form-row--stacked">
            <label className="pay-form-row__label" htmlFor="pay-supplier">
              Supplier
            </label>
            <select
              id="pay-supplier"
              className="form-select"
              value={supplierId}
              onChange={(e) => {
                setSupplierId(e.target.value);
                if (!lockedFromInvoice) setInvoiceId('');
              }}
              disabled={loadingRefs || lockedFromInvoice}
              required
            >
              <option value="">Select supplier</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </div>

          <div className="pay-form-row pay-form-row--stacked">
            <label className="pay-form-row__label" htmlFor="pay-invoice">
              Linked Invoice{lockedFromInvoice ? '' : ' (optional)'}
            </label>
            <select
              id="pay-invoice"
              className="form-select"
              value={invoiceId}
              onChange={(e) => setInvoiceId(e.target.value)}
              disabled={!supplierId || lockedFromInvoice}
              required={lockedFromInvoice}
            >
              <option value="">Select invoice</option>
              {supplierInvoices.map((invoice) => (
                <option key={invoice.id} value={invoice.id}>
                  {invoice.invoiceNumber ?? invoice.originalFilename ?? invoice.id.slice(0, 8)} —{' '}
                  {invoice.totalAmount?.toFixed(2)} {invoice.currency}
                </option>
              ))}
            </select>
            {supplierId && supplierInvoices.length === 0 && !lockedFromInvoice && (
              <p className="po-form-hint">No payable invoices for this supplier.</p>
            )}
          </div>

          {selectedInvoice && isInvoicePayable(selectedInvoice) && (
            <div className="inv-totals-panel">
              <div className="inv-totals-row">
                <span>Invoice total</span>
                <span>
                  {selectedInvoice.totalAmount?.toFixed(2)} {selectedInvoice.currency}
                </span>
              </div>
            </div>
          )}

          <div className="pay-form-row">
            <label className="pay-form-row__label" htmlFor="pay-amount">
              Amount
            </label>
            <input
              id="pay-amount"
              type="number"
              className="form-input"
              min={0.01}
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          <div className="pay-form-row">
            <label className="pay-form-row__label" htmlFor="pay-currency">
              Currency
            </label>
            <input
              id="pay-currency"
              className="form-input"
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              maxLength={3}
              required
            />
          </div>

          <div className="pay-form-row">
            <label className="pay-form-row__label" htmlFor="pay-due-date">
              Due Date
            </label>
            <input
              id="pay-due-date"
              type="date"
              className="form-input"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
            />
          </div>

          <div className="pay-form-row pay-form-row--stacked">
            <label className="pay-form-row__label" htmlFor="pay-method">
              Payment Method
            </label>
            <select
              id="pay-method"
              className="form-select"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
            >
              <option value="check">Check</option>
              <option value="cash">Cash</option>
            </select>
          </div>

          <div className="pay-form-row">
            <label className="pay-form-row__label" htmlFor="pay-scheduled">
              Scheduled Date
            </label>
            <input
              id="pay-scheduled"
              type="date"
              className="form-input"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
            />
          </div>

          <div className="pay-form-row">
            <label className="pay-form-row__label" htmlFor="pay-delivery">
              Delivery Date
            </label>
            <input
              id="pay-delivery"
              type="date"
              className="form-input"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
            />
          </div>

          <div className="pay-form-row pay-form-row--stacked">
            <label className="pay-form-row__label" htmlFor="pay-description">
              Description
            </label>
            <textarea
              id="pay-description"
              className="form-textarea"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="pay-form-row">
            <label className="pay-form-row__label" htmlFor="pay-external-ref">
              External Reference
            </label>
            <input
              id="pay-external-ref"
              className="form-input"
              value={externalReference}
              onChange={(e) => setExternalReference(e.target.value)}
            />
          </div>

          <div className="pay-form-row">
            <label className="pay-form-row__label" htmlFor="pay-bank-ref">
              Bank Reference
            </label>
            <input
              id="pay-bank-ref"
              className="form-input"
              value={bankReference}
              onChange={(e) => setBankReference(e.target.value)}
            />
          </div>

          <div className="pay-actions-bar">
            <button type="button" className="btn btn--ghost" onClick={() => navigate('/payments')}>
              Cancel
            </button>
            <button type="submit" className="btn" disabled={submitting || loadingRefs}>
              {submitting ? 'Creating…' : lockedFromInvoice ? 'Create Linked Payment' : 'Create Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
