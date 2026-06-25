import { useEffect, useState, type FormEvent } from 'react';
import { apiClient, getApiErrorMessage } from '../../api/client';
import type { Supplier } from '../../types/supplier';
import {
  emptySupplierForm,
  formValuesToPayload,
  parseProductCategories,
  supplierToFormValues,
  type SupplierFormValues,
} from '../../types/supplier';
import { Modal } from '../ui/Modal';
import './SupplierFormModal.css';

interface SupplierFormModalProps {
  isOpen: boolean;
  supplier: Supplier | null;
  onClose: () => void;
  onSuccess: (supplier?: Supplier) => void;
}

export function SupplierFormModal({ isOpen, supplier, onClose, onSuccess }: SupplierFormModalProps) {
  const isEdit = !!supplier;
  const [values, setValues] = useState<SupplierFormValues>(emptySupplierForm());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setValues(supplier ? supplierToFormValues(supplier) : emptySupplierForm());
    setError(null);
  }, [isOpen, supplier]);

  const setField = <K extends keyof SupplierFormValues>(key: K, value: SupplierFormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const categoryTags = parseProductCategories(values.productCategoriesInput);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (values.allowsPartialPayment && values.requiresFullPayment) {
      setError(
        'Partial payment and full payment cannot both be enabled. Uncheck one of these options.',
      );
      return;
    }

    const email = values.email.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    setSubmitting(true);

    const payload = formValuesToPayload(values);

    try {
      if (isEdit && supplier) {
        const { data } = await apiClient.patch<{ supplier: Supplier }>(
          `/api/suppliers/${supplier.id}`,
          payload,
        );
        onSuccess(data.supplier);
      } else {
        await apiClient.post<{ id: string }>('/api/suppliers', payload);
        onSuccess();
      }
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to save supplier.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      id="supplier-form-modal"
      title={isEdit ? 'Edit Supplier' : 'Create Supplier'}
      isOpen={isOpen}
      onClose={onClose}
      maxWidth={760}
      className="modal--role-form"
    >
      <form onSubmit={handleSubmit} id="supplier-form" className="supplier-form">
        <div className="supplier-form__scroll">
          {error && (
            <div className="alert-error" id="supplier-form-error" role="alert">
              {error}
            </div>
          )}

          <section className="supplier-form__section">
            <h3 className="supplier-form__section-title">General</h3>
            <div className="supplier-form__grid">
              <div className="form-group">
                <label className="form-label" htmlFor="supplier-name">Name *</label>
                <input
                  id="supplier-name"
                  className="form-input"
                  value={values.name}
                  onChange={(e) => setField('name', e.target.value)}
                  required
                  maxLength={255}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="supplier-tax-id">Tax Identifier / ICE</label>
                <input
                  id="supplier-tax-id"
                  className="form-input"
                  value={values.taxIdentifier}
                  onChange={(e) => setField('taxIdentifier', e.target.value)}
                  maxLength={100}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="supplier-legal-name">Legal Name</label>
                <input
                  id="supplier-legal-name"
                  className="form-input"
                  value={values.legalName}
                  onChange={(e) => setField('legalName', e.target.value)}
                  maxLength={255}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="supplier-trade-name">Trade Name</label>
                <input
                  id="supplier-trade-name"
                  className="form-input"
                  value={values.tradeName}
                  onChange={(e) => setField('tradeName', e.target.value)}
                  maxLength={255}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="supplier-rc">RC</label>
                <input
                  id="supplier-rc"
                  className="form-input"
                  value={values.rc}
                  onChange={(e) => setField('rc', e.target.value)}
                  maxLength={100}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="supplier-ice">ICE</label>
                <input
                  id="supplier-ice"
                  className="form-input"
                  value={values.ice}
                  onChange={(e) => setField('ice', e.target.value)}
                  maxLength={100}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="supplier-if">IF Number</label>
                <input
                  id="supplier-if"
                  className="form-input"
                  value={values.ifNumber}
                  onChange={(e) => setField('ifNumber', e.target.value)}
                  maxLength={100}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="supplier-contact-name">Contact Name</label>
                <input
                  id="supplier-contact-name"
                  className="form-input"
                  value={values.contactName}
                  onChange={(e) => setField('contactName', e.target.value)}
                  maxLength={255}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="supplier-email">Email</label>
                <input
                  id="supplier-email"
                  type="email"
                  className="form-input"
                  value={values.email}
                  onChange={(e) => setField('email', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="supplier-phone">Phone</label>
                <input
                  id="supplier-phone"
                  className="form-input"
                  value={values.phone}
                  onChange={(e) => setField('phone', e.target.value)}
                  maxLength={50}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="supplier-website">Website</label>
                <input
                  id="supplier-website"
                  className="form-input"
                  value={values.website}
                  onChange={(e) => setField('website', e.target.value)}
                  maxLength={500}
                />
              </div>
            </div>
          </section>

          <section className="supplier-form__section">
            <h3 className="supplier-form__section-title">Logistics & Risk</h3>
            <div className="supplier-form__grid">
              <div className="form-group">
                <label className="form-label" htmlFor="supplier-city">City</label>
                <input
                  id="supplier-city"
                  className="form-input"
                  value={values.city}
                  onChange={(e) => setField('city', e.target.value)}
                  maxLength={255}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="supplier-country">Country</label>
                <input
                  id="supplier-country"
                  className="form-input"
                  value={values.country}
                  onChange={(e) => setField('country', e.target.value)}
                  maxLength={100}
                />
              </div>
              <div className="form-group supplier-form__full">
                <label className="form-label" htmlFor="supplier-address">Address</label>
                <textarea
                  id="supplier-address"
                  className="form-textarea"
                  value={values.address}
                  onChange={(e) => setField('address', e.target.value)}
                  rows={2}
                />
              </div>
              <div className="form-group supplier-form__full">
                <label className="form-label" htmlFor="supplier-categories">
                  Product Categories
                </label>
                <input
                  id="supplier-categories"
                  className="form-input"
                  value={values.productCategoriesInput}
                  onChange={(e) => setField('productCategoriesInput', e.target.value)}
                  placeholder="logistics, freight, raw_materials"
                />
                {categoryTags.length > 0 && (
                  <div className="supplier-form__tags" id="supplier-category-tags">
                    {categoryTags.map((tag) => (
                      <span key={tag} className="supplier-form__tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="supplier-risk">Risk Level</label>
                <select
                  id="supplier-risk"
                  className="form-select"
                  value={values.riskLevel}
                  onChange={(e) => setField('riskLevel', e.target.value as SupplierFormValues['riskLevel'])}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div className="form-group supplier-form__checkboxes">
                <label className="supplier-form__checkbox">
                  <input
                    type="checkbox"
                    id="supplier-is-strategic"
                    checked={values.isStrategic}
                    onChange={(e) => setField('isStrategic', e.target.checked)}
                  />
                  Is Strategic
                </label>
                <label className="supplier-form__checkbox">
                  <input
                    type="checkbox"
                    id="supplier-has-alternative"
                    checked={values.hasAlternative}
                    onChange={(e) => setField('hasAlternative', e.target.checked)}
                  />
                  Has Alternative
                </label>
              </div>
            </div>
          </section>

          <section className="supplier-form__section">
            <h3 className="supplier-form__section-title">Payment Setup</h3>
            <div className="supplier-form__grid">
              <div className="form-group">
                <label className="form-label" htmlFor="supplier-payment-days">
                  Payment Deadline Days
                </label>
                <input
                  id="supplier-payment-days"
                  type="number"
                  min={0}
                  className="form-input"
                  value={values.paymentDeadlineDays}
                  onChange={(e) => setField('paymentDeadlineDays', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="supplier-payment-method">
                  Preferred Payment Method
                </label>
                <select
                  id="supplier-payment-method"
                  className="form-select"
                  value={values.preferredPaymentMethod}
                  onChange={(e) =>
                    setField('preferredPaymentMethod', e.target.value as SupplierFormValues['preferredPaymentMethod'])
                  }
                >
                  <option value="">None</option>
                  <option value="check">Check</option>
                  <option value="cash">Cash</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="supplier-bank">Bank Name</label>
                <input
                  id="supplier-bank"
                  className="form-input"
                  value={values.bankName}
                  onChange={(e) => setField('bankName', e.target.value)}
                  maxLength={255}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="supplier-rib">RIB / IBAN</label>
                <input
                  id="supplier-rib"
                  className="form-input"
                  value={values.ribIban}
                  onChange={(e) => setField('ribIban', e.target.value)}
                  maxLength={100}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="supplier-credit-limit">Credit Limit</label>
                <input
                  id="supplier-credit-limit"
                  type="number"
                  min={0}
                  className="form-input"
                  value={values.creditLimit}
                  onChange={(e) => setField('creditLimit', e.target.value)}
                />
              </div>
              <div className="form-group supplier-form__checkboxes">
                <label className="supplier-form__checkbox">
                  <input
                    type="checkbox"
                    id="supplier-partial-payment"
                    checked={values.allowsPartialPayment}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setValues((prev) => ({
                        ...prev,
                        allowsPartialPayment: checked,
                        requiresFullPayment: checked ? false : prev.requiresFullPayment,
                      }));
                    }}
                  />
                  Allows Partial Payment
                </label>
                <label className="supplier-form__checkbox">
                  <input
                    type="checkbox"
                    id="supplier-full-payment"
                    checked={values.requiresFullPayment}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setValues((prev) => ({
                        ...prev,
                        requiresFullPayment: checked,
                        allowsPartialPayment: checked ? false : prev.allowsPartialPayment,
                      }));
                    }}
                  />
                  Requires Full Payment
                </label>
                <label className="supplier-form__checkbox">
                  <input
                    type="checkbox"
                    id="supplier-payment-on-delivery"
                    checked={values.requiresPaymentOnDelivery}
                    onChange={(e) => setField('requiresPaymentOnDelivery', e.target.checked)}
                  />
                  Requires Payment on Delivery
                </label>
              </div>
            </div>
          </section>
        </div>

        <div className="modal__footer supplier-form__footer">
          <button
            type="button"
            className="btn btn--ghost"
            id="supplier-form-cancel"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button type="submit" className="btn" id="supplier-form-submit" disabled={submitting}>
            {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Supplier'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
