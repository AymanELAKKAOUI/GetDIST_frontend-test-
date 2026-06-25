import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Clock, Package, XCircle } from 'lucide-react';
import { apiClient, getApiErrorMessage } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import type { Supplier } from '../../types/supplier';
import {
  calculateLineTotal,
  formatCurrencyAmount,
  formatDateDisplay,
  formatDateTimeDisplay,
  normalizePurchaseOrder,
  type PurchaseOrder,
} from '../../types/purchaseOrder';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Spinner } from '../ui/Spinner';
import { useToast } from '../ui/Toast';
import { UploadDeliveryNoteModal } from '../deliveryNotes/UploadDeliveryNoteModal';
import { DeclinePurchaseOrderModal } from './DeclinePurchaseOrderModal';
import { PurchaseOrderStatusBadge } from './PurchaseOrderStatusBadge';
import './PurchaseOrders.css';

type PendingAction = 'submit' | 'approve' | 'send' | 'reopen' | 'accept' | null;

export function PurchaseOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { hasPermission, isSupplierPortalUser } = useAuth();

  const canManage = hasPermission('purchase_order.manage') && !isSupplierPortalUser;
  const canRespond = hasPermission('purchase_order.respond') && isSupplierPortalUser;
  const canUploadBl = isSupplierPortalUser && hasPermission('delivery_note.submit');

  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [supplierName, setSupplierName] = useState('—');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [uploadBlOpen, setUploadBlOpen] = useState(false);

  const fetchPo = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data } = await apiClient.get<{ purchaseOrder: PurchaseOrder }>(
        `/api/purchase-orders/${id}`,
      );
      const normalized = normalizePurchaseOrder(data.purchaseOrder);
      setPo(normalized);

      if (!isSupplierPortalUser) {
        try {
          const supplierRes = await apiClient.get<{ supplier: Supplier }>(
            `/api/suppliers/${normalized.supplierId}`,
          );
          setSupplierName(supplierRes.data.supplier.name);
        } catch {
          setSupplierName(normalized.supplierId.slice(0, 8) + '…');
        }
      }
    } catch {
      showToast('Purchase order not found.', 'error');
      navigate('/purchase-orders');
    } finally {
      setLoading(false);
    }
  }, [id, isSupplierPortalUser, navigate, showToast]);

  useEffect(() => {
    fetchPo();
  }, [fetchPo]);

  const actionConfig = getActionConfig(pendingAction, po);

  const handleConfirmAction = async () => {
    if (!po || !pendingAction) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const endpoints: Record<Exclude<PendingAction, null>, string> = {
        submit: `/api/purchase-orders/${po.id}/submit`,
        approve: `/api/purchase-orders/${po.id}/approve`,
        send: `/api/purchase-orders/${po.id}/send`,
        reopen: `/api/purchase-orders/${po.id}/reopen`,
        accept: `/api/purchase-orders/${po.id}/accept`,
      };
      await apiClient.post(endpoints[pendingAction]);
      showToast('Purchase order updated.');
      setPendingAction(null);
      fetchPo();
    } catch (err) {
      setActionError(getApiErrorMessage(err, 'Action failed.'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDecline = async (reason: string) => {
    if (!po) return;
    await apiClient.post(`/api/purchase-orders/${po.id}/decline`, { reason });
    showToast('Purchase order declined.');
    fetchPo();
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <Spinner size={32} />
      </div>
    );
  }

  if (!po) return null;

  const showSubmit = canManage && po.status === 'draft';
  const showApprove = canManage && po.status === 'submitted';
  const showSend = canManage && po.status === 'approved';
  const showReopen = canManage && po.status === 'declined';
  const showAccept = canRespond && po.status === 'sent';
  const showDecline = canRespond && po.status === 'sent';
  const showSendBl = canUploadBl && po.status === 'accepted';

  return (
    <div id="purchase-order-detail-page">
      <button type="button" className="po-detail-back" onClick={() => navigate('/purchase-orders')}>
        <ArrowLeft size={16} />
        Back to purchase orders
      </button>

      <div className="po-detail-header">
        <div>
          <h1 className="po-detail-header__title">{po.purchaseOrderNumber}</h1>
          <p className="po-detail-header__meta">
            {isSupplierPortalUser ? 'Purchase order from your client' : `Supplier: ${supplierName}`}
          </p>
        </div>
        <PurchaseOrderStatusBadge
          status={po.status}
          title={po.declineReason ?? undefined}
          strikethrough={po.status === 'cancelled'}
        />
      </div>

      {!isSupplierPortalUser && po.status === 'sent' && (
        <div className="po-response-banner po-response-banner--pending">
          <Clock size={18} />
          <span>Awaiting supplier response — the supplier can accept or decline this purchase order.</span>
        </div>
      )}

      {po.status === 'accepted' && po.respondedAt && (
        <div className="po-response-banner po-response-banner--accepted">
          <CheckCircle2 size={18} />
          <span>
            {isSupplierPortalUser ? 'You accepted' : 'Supplier accepted'} on{' '}
            {formatDateTimeDisplay(po.respondedAt)}
          </span>
        </div>
      )}

      {po.status === 'declined' && po.respondedAt && (
        <div className="po-response-banner po-response-banner--declined">
          <XCircle size={18} />
          <div>
            <div>
              {isSupplierPortalUser ? 'You declined' : 'Supplier declined'} on{' '}
              {formatDateTimeDisplay(po.respondedAt)}
            </div>
            {po.declineReason && (
              <div style={{ marginTop: 6, fontSize: 13 }}>Reason: {po.declineReason}</div>
            )}
          </div>
        </div>
      )}

      <div className="po-detail-grid">
        <div>
          <div className="po-detail-field__label">Order Date</div>
          <div className="po-detail-field__value">{formatDateDisplay(po.orderDate)}</div>
        </div>
        <div>
          <div className="po-detail-field__label">Expected Delivery</div>
          <div className="po-detail-field__value">{formatDateDisplay(po.expectedDeliveryDate)}</div>
        </div>
        <div>
          <div className="po-detail-field__label">Total Amount</div>
          <div className="po-detail-field__value">
            {formatCurrencyAmount(po.totalAmount, po.currency)}
          </div>
        </div>
        {po.respondedAt && (
          <div>
            <div className="po-detail-field__label">Responded At</div>
            <div className="po-detail-field__value">{formatDateTimeDisplay(po.respondedAt)}</div>
          </div>
        )}
      </div>

      {isSupplierPortalUser && po.status === 'accepted' && !canUploadBl && (
        <div className="po-response-banner po-response-banner--pending" style={{ marginBottom: 16 }}>
          You cannot upload a delivery note yet — your account is missing the delivery_note.submit
          permission. Ask your client to re-provision your portal user from the Suppliers page.
        </div>
      )}

      {po.declineReason && po.status !== 'declined' && (
        <div className="alert-error" style={{ marginBottom: 16 }}>
          Decline reason: {po.declineReason}
        </div>
      )}

      <h2 className="po-detail-section-title">Line Items</h2>
      <div className="table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Product</th>
              <th style={{ width: 100 }}>Qty</th>
              <th style={{ width: 140 }}>Unit Price</th>
              <th style={{ width: 140 }}>Line Total</th>
            </tr>
          </thead>
          <tbody>
            {po.lineItems.map((item, index) => (
              <tr key={index}>
                <td>{item.productName}</td>
                <td>{item.quantity}</td>
                <td>{formatCurrencyAmount(item.unitPrice, po.currency)}</td>
                <td>{formatCurrencyAmount(calculateLineTotal(item), po.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(showSubmit || showApprove || showSend || showReopen || showAccept || showDecline || showSendBl) && (
        <div className="po-detail-actions">
          {showSendBl && (
            <button type="button" className="btn" onClick={() => setUploadBlOpen(true)}>
              <Package size={16} />
              Send Delivery Note (BL)
            </button>
          )}
          {showSubmit && (
            <button type="button" className="btn" onClick={() => setPendingAction('submit')}>
              Submit
            </button>
          )}
          {showApprove && (
            <button type="button" className="btn" onClick={() => setPendingAction('approve')}>
              Approve
            </button>
          )}
          {showSend && (
            <button type="button" className="btn" onClick={() => setPendingAction('send')}>
              Send to Supplier
            </button>
          )}
          {showReopen && (
            <button type="button" className="btn btn--ghost" onClick={() => setPendingAction('reopen')}>
              Reopen
            </button>
          )}
          {showAccept && (
            <button type="button" className="btn btn--accept" onClick={() => setPendingAction('accept')}>
              <CheckCircle2 size={16} />
              Accept
            </button>
          )}
          {showDecline && (
            <button type="button" className="btn btn--destructive" onClick={() => setDeclineOpen(true)}>
              <XCircle size={16} />
              Decline
            </button>
          )}
        </div>
      )}

      {actionConfig && (
        <ConfirmDialog
          id="po-action-dialog"
          isOpen={!!pendingAction}
          title={actionConfig.title}
          message={actionConfig.message}
          confirmLabel={actionConfig.confirmLabel}
          isLoading={actionLoading}
          error={actionError}
          onConfirm={handleConfirmAction}
          onCancel={() => {
            setPendingAction(null);
            setActionError(null);
          }}
        />
      )}

      <DeclinePurchaseOrderModal
        isOpen={declineOpen}
        poNumber={po.purchaseOrderNumber}
        onClose={() => setDeclineOpen(false)}
        onConfirm={handleDecline}
      />

      {po && (
        <UploadDeliveryNoteModal
          isOpen={uploadBlOpen}
          purchaseOrder={po}
          onClose={() => setUploadBlOpen(false)}
          onSuccess={() => setUploadBlOpen(false)}
        />
      )}
    </div>
  );
}

function getActionConfig(pendingAction: PendingAction, po: PurchaseOrder | null) {
  if (!pendingAction || !po) return null;
  const configs: Record<Exclude<PendingAction, null>, { title: string; message: string; confirmLabel: string }> = {
    submit: {
      title: 'Submit Purchase Order',
      message: `Submit ${po.purchaseOrderNumber} for approval?`,
      confirmLabel: 'Submit',
    },
    approve: {
      title: 'Approve Purchase Order',
      message: `Approve ${po.purchaseOrderNumber}?`,
      confirmLabel: 'Approve',
    },
    send: {
      title: 'Send to Supplier',
      message: `Send ${po.purchaseOrderNumber} to the supplier?`,
      confirmLabel: 'Send',
    },
    reopen: {
      title: 'Reopen Purchase Order',
      message: `Reopen ${po.purchaseOrderNumber} as draft?`,
      confirmLabel: 'Reopen',
    },
    accept: {
      title: 'Accept Purchase Order',
      message: `Accept purchase order ${po.purchaseOrderNumber}?`,
      confirmLabel: 'Accept',
    },
  };
  return configs[pendingAction];
}
