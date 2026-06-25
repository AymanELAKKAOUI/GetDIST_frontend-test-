import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Calendar, Plus, X } from 'lucide-react';
import { apiClient, getApiErrorMessage } from '../../api/client';
import type { Supplier } from '../../types/supplier';
import {
  calculateGrandTotal,
  calculateLineTotal,
  emptyLineItem,
  formatCurrencyAmount,
  suggestPurchaseOrderNumber,
  todayIsoDate,
  type PurchaseOrderLineItem,
} from '../../types/purchaseOrder';
import { Modal } from '../ui/Modal';
import './CreatePurchaseOrderModal.css';
import './PurchaseOrders.css';

interface CreatePurchaseOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (id: string) => void;
}

const CURRENCY_OPTIONS = ['MAD', 'EUR', 'USD'] as const;

const PAYMENT_TERMS_OPTIONS = [
  { value: 'cash_on_order', label: 'Cash on order' },
  { value: 'net_30', label: 'Net 30 days' },
  { value: 'net_60', label: 'Net 60 days' },
  { value: 'net_90', label: 'Net 90 days' },
] as const;

const PAYMENT_METHOD_OPTIONS = [
  { value: 'check', label: 'Check (LCN)' },
  { value: 'cash', label: 'Cash' },
  { value: 'transfer', label: 'Bank transfer' },
] as const;

function defaultPaymentTerms(supplier: Supplier | null): (typeof PAYMENT_TERMS_OPTIONS)[number]['value'] {
  if (!supplier) return 'net_30';
  if (supplier.requiresPaymentOnDelivery) return 'cash_on_order';
  if (supplier.paymentDeadlineDays >= 60) return 'net_60';
  if (supplier.paymentDeadlineDays >= 30) return 'net_30';
  return 'cash_on_order';
}

function supplierHint(supplier: Supplier | null): string | null {
  if (!supplier) return null;
  const parts: string[] = [];
  if (supplier.creditLimit != null) {
    parts.push(`Credit limit: ${formatCurrencyAmount(supplier.creditLimit, 'MAD')}`);
  }
  if (supplier.isStrategic) parts.push('Strategic supplier');
  if (parts.length === 0) {
    return 'No default discount configured for this supplier.';
  }
  return parts.join(' · ');
}

export function CreatePurchaseOrderModal({ isOpen, onClose, onSuccess }: CreatePurchaseOrderModalProps) {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(false);

  const [companyName, setCompanyName] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [supplierReference, setSupplierReference] = useState('');
  const [paymentTerms, setPaymentTerms] =
    useState<(typeof PAYMENT_TERMS_OPTIONS)[number]['value']>('net_30');
  const [paymentMethod, setPaymentMethod] =
    useState<(typeof PAYMENT_METHOD_OPTIONS)[number]['value']>('check');
  const [purchaseOrderNumber, setPurchaseOrderNumber] = useState('');
  const [orderDate, setOrderDate] = useState(todayIsoDate());
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [currency, setCurrency] = useState<(typeof CURRENCY_OPTIONS)[number]>('MAD');
  const [lineItems, setLineItems] = useState<PurchaseOrderLineItem[]>([emptyLineItem()]);

  const selectedSupplier = useMemo(
    () => suppliers.find((s) => s.id === supplierId) ?? null,
    [suppliers, supplierId],
  );

  const grandTotal = useMemo(() => calculateGrandTotal(lineItems), [lineItems]);
  const totalItemQty = useMemo(
    () => lineItems.reduce((sum, item) => sum + (item.quantity || 0), 0),
    [lineItems],
  );

  const resetForm = useCallback(() => {
    setStep(1);
    setSubmitting(false);
    setError(null);
    setCompanyName('');
    setSupplierId('');
    setSupplierReference('');
    setPaymentTerms('net_30');
    setPaymentMethod('check');
    setPurchaseOrderNumber(suggestPurchaseOrderNumber());
    setOrderDate(todayIsoDate());
    setExpectedDeliveryDate('');
    setCurrency('MAD');
    setLineItems([emptyLineItem()]);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    resetForm();
    setLoadingRefs(true);
    apiClient
      .get<{ suppliers: Supplier[] }>('/api/suppliers', { params: { status: 'active' } })
      .then(({ data }) => setSuppliers(data.suppliers))
      .catch(() => setSuppliers([]))
      .finally(() => setLoadingRefs(false));
  }, [isOpen, resetForm]);

  useEffect(() => {
    if (!selectedSupplier) return;
    setPaymentTerms(defaultPaymentTerms(selectedSupplier));
    setPaymentMethod(selectedSupplier.preferredPaymentMethod === 'cash' ? 'cash' : 'check');
  }, [selectedSupplier]);

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const validateStep1 = () => {
    if (!supplierId) {
      setError('Please select a supplier.');
      return false;
    }
    if (!purchaseOrderNumber.trim()) {
      setError('Purchase order number is required.');
      return false;
    }
    if (!orderDate) {
      setError('Order date is required.');
      return false;
    }
    setError(null);
    return true;
  };

  const validateStep2 = () => {
    const valid = lineItems.filter((item) => item.productName.trim() && item.quantity > 0);
    if (valid.length === 0) {
      setError('Add at least one line item with product and quantity.');
      return false;
    }
    setError(null);
    return true;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateStep2()) return;

    setSubmitting(true);
    setError(null);

    try {
      const { data } = await apiClient.post<{ id: string }>('/api/purchase-orders', {
        supplierId,
        purchaseOrderNumber: purchaseOrderNumber.trim(),
        orderDate,
        expectedDeliveryDate: expectedDeliveryDate || undefined,
        lineItems: lineItems.map((item) => ({
          productName: item.productName.trim(),
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
        currency,
      });
      onSuccess(data.id);
      handleClose();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to create purchase order.'));
    } finally {
      setSubmitting(false);
    }
  };

  const updateLineItem = (index: number, patch: Partial<PurchaseOrderLineItem>) => {
    setLineItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  return (
    <Modal
      id="create-po-modal"
      title="New Purchase Order"
      isOpen={isOpen}
      onClose={handleClose}
      maxWidth={760}
      className="modal--po-form"
    >
      <div className="po-wizard">
        <div className="po-wizard__step-label">Step {step} / 2</div>
        {error && (
          <div className="alert-error" role="alert">
            {error}
          </div>
        )}

        {step === 1 ? (
          <div className="po-form-grid">
            <div className="po-form-row">
              <label className="po-form-row__label" htmlFor="create-po-company">
                Company
              </label>
              <input
                id="create-po-company"
                className="form-input"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Your company name"
              />
            </div>

            <div className="po-form-row po-form-row--stacked po-form-row--field-block">
              <label className="po-form-row__label" htmlFor="create-po-supplier">
                Supplier
              </label>
              <div>
                <select
                  id="create-po-supplier"
                  className="form-select"
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  disabled={loadingRefs}
                  required
                >
                  <option value="">{loadingRefs ? 'Loading…' : 'Select a supplier'}</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                {selectedSupplier && supplierHint(selectedSupplier) && (
                  <p className="po-form-hint">{supplierHint(selectedSupplier)}</p>
                )}
              </div>
            </div>

            <div className="po-form-row">
              <label className="po-form-row__label" htmlFor="create-po-number">
                PO Number
              </label>
              <input
                id="create-po-number"
                className="form-input"
                value={purchaseOrderNumber}
                onChange={(e) => setPurchaseOrderNumber(e.target.value)}
                placeholder="BC-2026-003"
                required
              />
            </div>

            <div className="po-form-row">
              <label className="po-form-row__label" htmlFor="create-po-supplier-ref">
                Supplier Reference
              </label>
              <input
                id="create-po-supplier-ref"
                className="form-input"
                value={supplierReference}
                onChange={(e) => setSupplierReference(e.target.value)}
                placeholder="Supplier reference"
              />
            </div>

            <div className="po-form-row">
              <label className="po-form-row__label" htmlFor="create-po-order-date">
                Order Date
              </label>
              <div className="po-form-row__date">
                <input
                  id="create-po-order-date"
                  type="date"
                  className="form-input"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  required
                />
                <Calendar size={16} className="po-form-row__date-icon" aria-hidden="true" />
              </div>
            </div>

            <div className="po-form-row">
              <label className="po-form-row__label" htmlFor="create-po-payment-terms">
                Payment Terms
              </label>
              <select
                id="create-po-payment-terms"
                className="form-select"
                value={paymentTerms}
                onChange={(e) =>
                  setPaymentTerms(e.target.value as (typeof PAYMENT_TERMS_OPTIONS)[number]['value'])
                }
              >
                {PAYMENT_TERMS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="po-form-row">
              <label className="po-form-row__label" htmlFor="create-po-payment-method">
                Payment Method
              </label>
              <select
                id="create-po-payment-method"
                className="form-select"
                value={paymentMethod}
                onChange={(e) =>
                  setPaymentMethod(e.target.value as (typeof PAYMENT_METHOD_OPTIONS)[number]['value'])
                }
              >
                {PAYMENT_METHOD_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="po-form-row">
              <label className="po-form-row__label" htmlFor="create-po-delivery-date">
                Delivery Date
              </label>
              <div className="po-form-row__date">
                <input
                  id="create-po-delivery-date"
                  type="date"
                  className="form-input"
                  value={expectedDeliveryDate}
                  onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                />
                <Calendar size={16} className="po-form-row__date-icon" aria-hidden="true" />
              </div>
            </div>

            <div className="po-form-row">
              <label className="po-form-row__label" htmlFor="create-po-currency">
                Currency
              </label>
              <select
                id="create-po-currency"
                className="form-select"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as (typeof CURRENCY_OPTIONS)[number])}
              >
                {CURRENCY_OPTIONS.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <>
            <div className="po-lines-toolbar">
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => setLineItems((prev) => [...prev, emptyLineItem()])}
              >
                <Plus size={16} />
                Add line
              </button>
            </div>
            <table className="po-lines-table">
              <thead>
                <tr>
                  <th>Product Ref</th>
                  <th style={{ width: 90 }}>Qty</th>
                  <th style={{ width: 120 }}>Unit Price</th>
                  <th style={{ width: 100 }}>Line Total</th>
                  <th style={{ width: 80 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item, index) => (
                  <tr key={index}>
                    <td>
                      <input
                        className="form-input"
                        value={item.productName}
                        onChange={(e) => updateLineItem(index, { productName: e.target.value })}
                        placeholder="Product reference"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min={1}
                        className="form-input"
                        value={item.quantity}
                        onChange={(e) =>
                          updateLineItem(index, { quantity: Number(e.target.value) || 0 })
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className="form-input"
                        value={item.unitPrice}
                        onChange={(e) =>
                          updateLineItem(index, { unitPrice: Number(e.target.value) || 0 })
                        }
                      />
                    </td>
                    <td className="po-line-total">
                      {formatCurrencyAmount(calculateLineTotal(item), currency)}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="po-line-remove"
                        onClick={() =>
                          setLineItems((prev) =>
                            prev.length <= 1 ? prev : prev.filter((_, i) => i !== index),
                          )
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
            <div className="po-lines-total">Total items: {totalItemQty}</div>
            <div className="po-grand-total">
              Grand total: {formatCurrencyAmount(grandTotal, currency)}
            </div>
          </>
        )}

        <div className="po-wizard__footer">
          {step === 2 ? (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                setStep(1);
                setError(null);
              }}
            >
              <ArrowLeft size={16} />
              Previous
            </button>
          ) : (
            <span />
          )}
          <div className="po-wizard__footer-right">
            <button type="button" className="btn btn--ghost" onClick={handleClose}>
              Cancel
            </button>
            {step === 1 ? (
              <button
                type="button"
                className="btn"
                onClick={() => validateStep1() && setStep(2)}
              >
                Next
                <ArrowRight size={16} />
              </button>
            ) : (
              <button type="button" className="btn" disabled={submitting} onClick={handleSubmit}>
                {submitting ? 'Saving…' : 'Save'}
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
