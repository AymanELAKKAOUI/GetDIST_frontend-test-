import { useState, type FormEvent } from 'react';
import { Calendar, Plus, X } from 'lucide-react';
import { apiClient, getApiErrorMessage } from '../../api/client';
import {
  emptySection,
  suggestDeliveryNoteNumber,
  todayIsoDate,
  type DeliveryNoteSection,
} from '../../types/deliveryNote';
import { useToast } from '../ui/Toast';
import './DeliveryNotes.css';

interface VerifyDeliveryNoteFormProps {
  deliveryNoteId: string;
  onSuccess: () => void;
}

export function VerifyDeliveryNoteForm({ deliveryNoteId, onSuccess }: VerifyDeliveryNoteFormProps) {
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [deliveryNoteNumber, setDeliveryNoteNumber] = useState(suggestDeliveryNoteNumber());
  const [deliveryDate, setDeliveryDate] = useState(todayIsoDate());
  const [sections, setSections] = useState<DeliveryNoteSection[]>([emptySection()]);

  const updateSection = (index: number, patch: Partial<DeliveryNoteSection>) => {
    setSections((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!deliveryNoteNumber.trim()) {
      setError('Delivery note number is required.');
      return;
    }
    if (!deliveryDate) {
      setError('Delivery date is required.');
      return;
    }

    const validSections = sections.filter((s) => s.titre.trim() && s.description.trim());
    if (validSections.length === 0) {
      setError('Add at least one section with title and description.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await apiClient.post(`/api/delivery-notes/${deliveryNoteId}/verify`, {
        deliveryNoteNumber: deliveryNoteNumber.trim(),
        deliveryDate,
        lineItems: validSections.map((s) => ({
          titre: s.titre.trim(),
          description: s.description.trim(),
        })),
      });
      showToast('Delivery note verified successfully.');
      onSuccess();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to verify delivery note.'));
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

      <div className="dn-form-grid">
        <div className="dn-form-row">
          <label className="dn-form-row__label" htmlFor="verify-bl-number">
            Delivery Note Number
          </label>
          <input
            id="verify-bl-number"
            className="form-input"
            value={deliveryNoteNumber}
            onChange={(e) => setDeliveryNoteNumber(e.target.value)}
            required
          />
        </div>
        <div className="dn-form-row">
          <label className="dn-form-row__label" htmlFor="verify-bl-date">
            Delivery Date
          </label>
          <div style={{ position: 'relative' }}>
            <input
              id="verify-bl-date"
              type="date"
              className="form-input"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
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
      </div>

      <div style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span className="dn-form-row__label">Sections (title + description)</span>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => setSections((prev) => [...prev, emptySection()])}
          >
            <Plus size={16} />
            Add section
          </button>
        </div>

        <div className="dn-sections-list">
          {sections.map((section, index) => (
            <div key={index} className="dn-section-row">
              <input
                className="form-input"
                value={section.titre}
                onChange={(e) => updateSection(index, { titre: e.target.value })}
                placeholder="Title"
              />
              <input
                className="form-input"
                value={section.description}
                onChange={(e) => updateSection(index, { description: e.target.value })}
                placeholder="Description"
              />
              <button
                type="button"
                className="po-line-remove"
                onClick={() =>
                  setSections((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)))
                }
                aria-label="Remove section"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="dn-wizard__footer">
        <span />
        <button type="submit" className="btn" disabled={submitting}>
          {submitting ? 'Saving…' : 'Verify & Save'}
        </button>
      </div>
    </form>
  );
}
