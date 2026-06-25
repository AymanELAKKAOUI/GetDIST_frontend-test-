import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { apiClient } from '../../api/client';
import { fetchDeliveryNotePdfBlob } from '../../api/deliveryNotes';
import { useAuth } from '../../context/AuthContext';
import type { DeliveryNote } from '../../types/deliveryNote';
import { Spinner } from '../ui/Spinner';
import { useToast } from '../ui/Toast';
import { DisputeDeliveryNoteModal } from './DisputeDeliveryNoteModal';
import { VerifyDeliveryNoteForm } from './VerifyDeliveryNoteForm';
import './DeliveryNotes.css';

export function DeliveryNoteReviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { hasPermission } = useAuth();

  const canRespond = hasPermission('delivery_note.respond');

  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState<DeliveryNote | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [disputeOpen, setDisputeOpen] = useState(false);

  const loadNote = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data } = await apiClient.get<{ deliveryNote: DeliveryNote }>(
        `/api/delivery-notes/${id}`,
      );
      setNote(data.deliveryNote);

      const blob = await fetchDeliveryNotePdfBlob(id);
      setPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
    } catch {
      showToast('Delivery note not found or unavailable.', 'error');
      navigate('/delivery-notes');
    } finally {
      setLoading(false);
    }
  }, [id, navigate, showToast]);

  useEffect(() => {
    loadNote();
    return () => {
      setPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [loadNote]);

  const handleDispute = async (reason: string) => {
    if (!id) return;
    await apiClient.post(`/api/delivery-notes/${id}/dispute`, { reason });
    showToast('Delivery note disputed.');
    navigate('/delivery-notes');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <Spinner size={32} />
      </div>
    );
  }

  if (!note) return null;

  const canReview = note.status === 'received' && canRespond;

  return (
    <div id="delivery-note-review-page">
      <button type="button" className="po-detail-back" onClick={() => navigate('/delivery-notes')}>
        <ArrowLeft size={16} />
        Back to delivery notes
      </button>

      <div className="page-header" style={{ marginBottom: 16 }}>
        <div>
          <h1 className="page-header__title">{note.originalFilename ?? 'Delivery Note Review'}</h1>
          <p className="page-header__subtitle">
            Review the uploaded PDF and enter BL details to verify, or dispute if invalid.
          </p>
        </div>
        {canReview && (
          <button type="button" className="btn btn--destructive btn--sm" onClick={() => setDisputeOpen(true)}>
            Dispute
          </button>
        )}
      </div>

      <div className="dn-review-layout">
        <div className="dn-review-pdf">
          <div className="dn-review-pdf__header">Document Preview</div>
          <div className="dn-review-pdf__frame">
            {pdfUrl ? (
              <iframe src={pdfUrl} title="Delivery note PDF preview" />
            ) : (
              <div style={{ padding: 24, color: 'var(--text-muted)' }}>Unable to load PDF preview.</div>
            )}
          </div>
        </div>

        <div className="dn-review-panel">
          <div className="dn-review-panel__header">
            <h2 className="dn-review-panel__title">Verify & Accept</h2>
          </div>

          {!canReview ? (
            <div className="dn-rejection-banner">
              This delivery note is no longer pending review (status: {note.status}).
            </div>
          ) : (
            <VerifyDeliveryNoteForm
              deliveryNoteId={note.id}
              onSuccess={() => navigate('/delivery-notes')}
            />
          )}
        </div>
      </div>

      <DisputeDeliveryNoteModal
        isOpen={disputeOpen}
        filename={note.originalFilename}
        onClose={() => setDisputeOpen(false)}
        onConfirm={handleDispute}
      />
    </div>
  );
}
