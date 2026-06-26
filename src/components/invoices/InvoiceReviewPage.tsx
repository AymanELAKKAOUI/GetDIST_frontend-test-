import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { apiClient } from '../../api/client';
import { fetchInvoicePdfBlob } from '../../api/invoices';
import { useAuth } from '../../context/AuthContext';
import type { Invoice } from '../../types/invoice';
import type { PurchaseOrder } from '../../types/purchaseOrder';
import { Spinner } from '../ui/Spinner';
import { useToast } from '../ui/Toast';
import { DisputeInvoiceModal } from './DisputeInvoiceModal';
import { VerifyInvoiceForm } from './VerifyInvoiceForm';
import '../deliveryNotes/DeliveryNotes.css';

export function InvoiceReviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { hasPermission } = useAuth();

  const canRespond = hasPermission('invoice.respond');

  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [purchaseOrderTotal, setPurchaseOrderTotal] = useState<number | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [disputeOpen, setDisputeOpen] = useState(false);

  const loadInvoice = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data } = await apiClient.get<{ invoice: Invoice }>(`/api/invoices/${id}`);
      setInvoice(data.invoice);

      if (data.invoice.purchaseOrderId) {
        try {
          const poRes = await apiClient.get<{ purchaseOrder: PurchaseOrder }>(
            `/api/purchase-orders/${data.invoice.purchaseOrderId}`,
          );
          setPurchaseOrderTotal(poRes.data.purchaseOrder.totalAmount);
        } catch {
          setPurchaseOrderTotal(null);
        }
      }

      const blob = await fetchInvoicePdfBlob(id);
      setPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
    } catch {
      showToast('Invoice not found or unavailable.', 'error');
      navigate('/invoices');
    } finally {
      setLoading(false);
    }
  }, [id, navigate, showToast]);

  useEffect(() => {
    loadInvoice();
    return () => {
      setPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [loadInvoice]);

  const handleDispute = async (reason: string) => {
    if (!id) return;
    await apiClient.post(`/api/invoices/${id}/dispute`, { reason });
    showToast('Invoice disputed.');
    navigate('/invoices');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <Spinner size={32} />
      </div>
    );
  }

  if (!invoice) return null;

  const canReview = invoice.status === 'received' && canRespond;

  return (
    <div id="invoice-review-page">
      <button type="button" className="po-detail-back" onClick={() => navigate('/invoices')}>
        <ArrowLeft size={16} />
        Back to invoices
      </button>

      <div className="page-header" style={{ marginBottom: 16 }}>
        <div>
          <h1 className="page-header__title">{invoice.originalFilename ?? 'Invoice Review'}</h1>
          <p className="page-header__subtitle">
            Review the uploaded PDF and enter invoice details to verify, or dispute if invalid.
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
              <iframe src={pdfUrl} title="Invoice PDF preview" />
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
              This invoice is no longer pending review (status: {invoice.status}).
            </div>
          ) : (
            <VerifyInvoiceForm
              invoice={invoice}
              purchaseOrderTotal={purchaseOrderTotal}
              onSuccess={() => navigate('/invoices')}
            />
          )}
        </div>
      </div>

      <DisputeInvoiceModal
        isOpen={disputeOpen}
        filename={invoice.originalFilename}
        onClose={() => setDisputeOpen(false)}
        onConfirm={handleDispute}
      />
    </div>
  );
}
