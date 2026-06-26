import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { apiClient, getApiErrorMessage } from '../../api/client';
import {
  approveApprovalRequest,
  cancelPayment,
  evaluatePayment,
  fetchPaymentDetail,
  getCheckProposalItems,
  getRescheduleValues,
  markPaymentPaid,
  rejectApprovalRequest,
  updatePaymentDraft,
} from '../../api/payments';
import { fetchCompanyDisplayName } from '../../api/company';
import { useAuth } from '../../context/AuthContext';
import type { Supplier } from '../../types/supplier';
import type { Invoice } from '../../types/invoice';
import type { ApprovalRequest, CheckRecord, Payment } from '../../types/payment';
import { formatDateDisplay, formatMoney } from '../../types/payment';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Spinner } from '../ui/Spinner';
import { useToast } from '../ui/Toast';
import { ApproveApprovalModal, RejectApprovalModal } from './ApprovalActionModals';
import { CheckStatusBadge, PaymentMethodBadge, PaymentStatusBadge } from './PaymentStatusBadge';
import './Payments.css';
import '../deliveryNotes/DeliveryNotes.css';
import '../invoices/Invoices.css';

function approvalTypeLabel(type: string): string {
  switch (type) {
    case 'payment_reschedule':
      return 'Payment Reschedule';
    case 'check_generation':
      return 'Check Generation';
    default:
      return type.replace(/_/g, ' ');
  }
}

function ApprovalsPanel({
  approvals,
  canApprove,
  onApprove,
  onReject,
}: {
  approvals: ApprovalRequest[];
  canApprove: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const pending = approvals.filter((a) => a.status === 'pending_validation');

  if (pending.length === 0) {
    return (
      <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>No pending approval requests.</p>
    );
  }

  return (
    <div>
      {pending.map((approval) => {
        const reschedule = approval.approvalType === 'payment_reschedule' ? getRescheduleValues(approval) : null;
        const checkItems = approval.approvalType === 'check_generation' ? getCheckProposalItems(approval) : [];

        return (
          <div key={approval.id} className="pay-approval-card">
            <div className="pay-approval-card__header">
              <span className="pay-approval-card__type">{approvalTypeLabel(approval.approvalType)}</span>
              <PaymentStatusBadge status="pending_validation" />
            </div>

            {approval.reason && (
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>
                {approval.reason}
              </p>
            )}

            {reschedule && (
              <div className="pay-approval-warning">
                Date conflicts with a non-working day. Proposed scheduled date:{' '}
                <strong>{formatDateDisplay(reschedule.scheduledDate)}</strong>
                {reschedule.conflictType && (
                  <>
                    {' '}
                    (Conflict: {reschedule.conflictType}
                    {reschedule.conflictName ? ` — ${reschedule.conflictName}` : ''})
                  </>
                )}
                {reschedule.originalDate && (
                  <div style={{ marginTop: 6, opacity: 0.85 }}>
                    Original date: {formatDateDisplay(reschedule.originalDate)}
                  </div>
                )}
              </div>
            )}

            {checkItems.length > 0 && (
              <div className="table-card" style={{ marginBottom: 12 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Amount</th>
                      <th>Issue Date</th>
                      <th>Expected Receipt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {checkItems.map((item, index) => (
                      <tr key={index}>
                        <td>{formatMoney(item.amount)}</td>
                        <td>{formatDateDisplay(item.issueDate)}</td>
                        <td>{formatDateDisplay(item.expectedReceiptDate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {approval.approvalType === 'check_generation' && checkItems.length === 0 && (
              <div className="pay-approval-warning">
                Proposed check split details are not included in the payment detail response. Approve
                or reject based on the PDF/workflow context, or ask an admin to verify backend item
                embedding.
              </div>
            )}

            {canApprove && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn--sm" onClick={() => onApprove(approval.id)}>
                  Approve Proposal
                </button>
                <button
                  type="button"
                  className="btn btn--destructive btn--sm"
                  onClick={() => onReject(approval.id)}
                >
                  Reject Proposal
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ChecksTable({ checks }: { checks: CheckRecord[] }) {
  if (checks.length === 0) {
    return (
      <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>No checks generated for this payment yet.</p>
    );
  }

  return (
    <div className="table-card">
      <table className="data-table">
        <thead>
          <tr>
            <th>Check Number</th>
            <th>Amount</th>
            <th>Issue Date</th>
            <th>Expected Receipt</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {checks.map((check) => (
            <tr key={check.id}>
              <td>{check.checkNumber ?? '—'}</td>
              <td>{formatMoney(check.amount)}</td>
              <td>{formatDateDisplay(check.issueDate)}</td>
              <td>{formatDateDisplay(check.expectedReceiptDate)}</td>
              <td>
                <CheckStatusBadge status={check.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PaymentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { hasPermission, hasAnyPermission, isSupplierPortalUser } = useAuth();

  const canUpdate = !isSupplierPortalUser && hasPermission('payment.update');
  const canCancel = !isSupplierPortalUser && hasPermission('payment.cancel');
  const canApprove =
    !isSupplierPortalUser &&
    hasAnyPermission(['payment.approve', 'approval.review']);

  const [loading, setLoading] = useState(true);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [checks, setChecks] = useState<CheckRecord[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [companyDisplayName, setCompanyDisplayName] = useState<string | null>(null);
  const [linkedInvoice, setLinkedInvoice] = useState<Invoice | null>(null);

  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [description, setDescription] = useState('');
  const [externalReference, setExternalReference] = useState('');
  const [bankReference, setBankReference] = useState('');
  const [invoiceId, setInvoiceId] = useState('');

  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmMarkPaid, setConfirmMarkPaid] = useState(false);
  const [approveTarget, setApproveTarget] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);

  const loadDetail = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const detail = await fetchPaymentDetail(id);
      setPayment(detail.payment);
      setChecks(detail.checks);
      setApprovals(detail.approvals);

      setAmount(String(detail.payment.amount));
      setDueDate(detail.payment.dueDate);
      setDeliveryDate(detail.payment.deliveryDate ?? '');
      setScheduledDate(detail.payment.scheduledDate ?? '');
      setDescription(detail.payment.description ?? '');
      setExternalReference(detail.payment.externalReference ?? '');
      setBankReference(detail.payment.bankReference ?? '');
      setInvoiceId(detail.payment.invoiceId ?? '');

      if (!isSupplierPortalUser) {
        try {
          const { data } = await apiClient.get<{ supplier: Supplier }>(
            `/api/suppliers/${detail.payment.supplierId}`,
          );
          setSupplier(data.supplier);
        } catch {
          setSupplier(null);
        }
      } else {
        setSupplier(null);
        const name = await fetchCompanyDisplayName(detail.payment.companyId, [detail.payment]);
        setCompanyDisplayName(name);
      }

      if (detail.payment.invoiceId) {
        try {
          const { data } = await apiClient.get<{ invoice: Invoice }>(
            `/api/invoices/${detail.payment.invoiceId}`,
          );
          setLinkedInvoice(data.invoice);
        } catch {
          setLinkedInvoice(null);
        }
      } else {
        setLinkedInvoice(null);
      }
    } catch {
      showToast('Payment not found.', 'error');
      navigate('/payments');
    } finally {
      setLoading(false);
    }
  }, [id, isSupplierPortalUser, navigate, showToast]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const isDraft = payment?.status === 'draft';
  const isPending = payment?.status === 'pending_validation';
  const isScheduled = payment?.status === 'scheduled';
  const isTerminal = payment?.status === 'paid' || payment?.status === 'cancelled';
  const canEditDraft = isDraft && canUpdate;
  const canEvaluate = isDraft && canUpdate;
  const canMarkPaid =
    canUpdate && payment && ['draft', 'pending_validation', 'scheduled'].includes(payment.status);

  const handleSaveDraft = async (e: FormEvent) => {
    e.preventDefault();
    if (!id || !payment) return;

    const parsedAmount = Number(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      setFormError('Amount must be greater than zero.');
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      await updatePaymentDraft(id, {
        amount: parsedAmount,
        dueDate,
        deliveryDate: deliveryDate || null,
        scheduledDate: scheduledDate || null,
        description: description.trim() || null,
        externalReference: externalReference.trim() || null,
        bankReference: bankReference.trim() || null,
        invoiceId: invoiceId || null,
      });
      showToast('Payment updated.');
      await loadDetail();
    } catch (err) {
      setFormError(getApiErrorMessage(err, 'Failed to update payment.'));
    } finally {
      setSaving(false);
    }
  };

  const handleEvaluate = async () => {
    if (!id || !payment) return;

    if (supplier?.requiresPaymentOnDelivery && !deliveryDate) {
      showToast('Delivery date is required for this supplier (payment on delivery).', 'error');
      return;
    }

    setActionLoading(true);
    try {
      await evaluatePayment(id);
      showToast('Payment evaluated.');
      await loadDetail();
    } catch (err) {
      showToast(getApiErrorMessage(err, 'Failed to evaluate payment.'), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!id) return;
    setActionLoading(true);
    try {
      await cancelPayment(id);
      showToast('Payment cancelled.');
      setConfirmCancel(false);
      await loadDetail();
    } catch (err) {
      showToast(getApiErrorMessage(err, 'Failed to cancel payment.'), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!id) return;
    setActionLoading(true);
    try {
      await markPaymentPaid(id);
      showToast('Payment marked as paid.');
      setConfirmMarkPaid(false);
      await loadDetail();
    } catch (err) {
      showToast(getApiErrorMessage(err, 'Failed to mark payment as paid.'), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async (comment: string) => {
    if (!approveTarget) return;
    await approveApprovalRequest(approveTarget, comment || undefined);
    showToast('Proposal approved.');
    setApproveTarget(null);
    await loadDetail();
  };

  const handleReject = async (reason: string) => {
    if (!rejectTarget) return;
    await rejectApprovalRequest(rejectTarget, reason);
    showToast('Proposal rejected.');
    setRejectTarget(null);
    await loadDetail();
  };

  const counterpartyLabel = isSupplierPortalUser ? 'Company' : 'Supplier';
  const counterpartyValue = isSupplierPortalUser
    ? payment?.companyName ?? companyDisplayName ?? '—'
    : payment?.supplierName ?? payment?.supplierId;

  const summaryRows = useMemo(() => {
    if (!payment) return [];
    return [
      [counterpartyLabel, counterpartyValue],
      ['Amount', formatMoney(payment.amount, payment.currency)],
      ['Due Date', formatDateDisplay(payment.dueDate)],
      ['Scheduled Date', formatDateDisplay(payment.scheduledDate)],
      ['Delivery Date', formatDateDisplay(payment.deliveryDate)],
      ['Method', payment.paymentMethod],
      ['Status', payment.status],
      ['Remaining Balance', formatMoney(payment.remainingBalance, payment.currency)],
      ['Paid At', payment.paidAt ? new Date(payment.paidAt).toLocaleString('en-GB') : '—'],
    ];
  }, [payment, counterpartyLabel, counterpartyValue]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <Spinner size={32} />
      </div>
    );
  }

  if (!payment) return null;

  return (
    <div id="payment-detail-page">
      <button type="button" className="po-detail-back" onClick={() => navigate('/payments')}>
        <ArrowLeft size={16} />
        Back to payments
      </button>

      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="page-header__title">Payment Details</h1>
          <p className="page-header__subtitle">
            {isSupplierPortalUser
              ? `${counterpartyValue} · ${formatMoney(payment.amount, payment.currency)}`
              : `${payment.supplierName ?? 'Supplier payment'} · ${formatMoney(payment.amount, payment.currency)}`}
            {linkedInvoice && (
              <>
                {' '}
                · Linked to{' '}
                <Link
                  to="/invoices"
                  state={{ openInvoiceId: linkedInvoice.id }}
                  className="inv-sent-link"
                >
                  {linkedInvoice.invoiceNumber ?? linkedInvoice.originalFilename ?? 'invoice'}
                </Link>
              </>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <PaymentMethodBadge method={payment.paymentMethod} />
          <PaymentStatusBadge status={payment.status} />
        </div>
      </div>

      <div className="pay-detail-grid">
        <div className="pay-panel">
          <h2 className="pay-panel__title">{canEditDraft ? 'Edit Draft Payment' : 'Payment Summary'}</h2>

          {formError && (
            <div className="alert-error" role="alert" style={{ marginBottom: 12 }}>
              {formError}
            </div>
          )}

          {supplier?.requiresPaymentOnDelivery && canEvaluate && (
            <div className="pay-approval-warning" style={{ marginBottom: 12 }}>
              This supplier requires payment on delivery — set a delivery date before evaluating.
            </div>
          )}

          {canEditDraft ? (
            <form className="pay-form-grid" onSubmit={handleSaveDraft}>
              <div className="pay-form-row">
                <span className="pay-form-row__label">{counterpartyLabel}</span>
                <input className="form-input" value={counterpartyValue ?? ''} disabled />
              </div>
              <div className="pay-form-row">
                <span className="pay-form-row__label">Currency</span>
                <input className="form-input" value={payment.currency} disabled />
              </div>
              <div className="pay-form-row">
                <span className="pay-form-row__label">Payment Method</span>
                <input className="form-input" value={payment.paymentMethod} disabled />
              </div>
              <div className="pay-form-row">
                <label className="pay-form-row__label" htmlFor="edit-amount">
                  Amount
                </label>
                <input
                  id="edit-amount"
                  type="number"
                  className="form-input"
                  min={0.01}
                  step="any"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className="pay-form-row">
                <label className="pay-form-row__label" htmlFor="edit-due">
                  Due Date
                </label>
                <input
                  id="edit-due"
                  type="date"
                  className="form-input"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
              <div className="pay-form-row">
                <label className="pay-form-row__label" htmlFor="edit-delivery">
                  Delivery Date
                </label>
                <input
                  id="edit-delivery"
                  type="date"
                  className="form-input"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                />
              </div>
              <div className="pay-form-row">
                <label className="pay-form-row__label" htmlFor="edit-scheduled">
                  Scheduled Date
                </label>
                <input
                  id="edit-scheduled"
                  type="date"
                  className="form-input"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                />
              </div>
              <div className="pay-form-row pay-form-row--stacked">
                <label className="pay-form-row__label" htmlFor="edit-description">
                  Description
                </label>
                <textarea
                  id="edit-description"
                  className="form-textarea"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="pay-form-row">
                <label className="pay-form-row__label" htmlFor="edit-external">
                  External Reference
                </label>
                <input
                  id="edit-external"
                  className="form-input"
                  value={externalReference}
                  onChange={(e) => setExternalReference(e.target.value)}
                />
              </div>
              <div className="pay-form-row">
                <label className="pay-form-row__label" htmlFor="edit-bank">
                  Bank Reference
                </label>
                <input
                  id="edit-bank"
                  className="form-input"
                  value={bankReference}
                  onChange={(e) => setBankReference(e.target.value)}
                />
              </div>
              <div className="pay-actions-bar">
                <button type="submit" className="btn btn--sm" disabled={saving}>
                  {saving ? 'Saving…' : 'Save Draft'}
                </button>
              </div>
            </form>
          ) : (
            <div className="dn-form-grid">
              {summaryRows.map(([label, value]) => (
                <div key={label} className="dn-form-row">
                  <span className="dn-form-row__label">{label}</span>
                  <span>{value}</span>
                </div>
              ))}
              {payment.description && (
                <div className="dn-form-row">
                  <span className="dn-form-row__label">Description</span>
                  <span>{payment.description}</span>
                </div>
              )}
              {payment.externalReference && (
                <div className="dn-form-row">
                  <span className="dn-form-row__label">External Reference</span>
                  <span>{payment.externalReference}</span>
                </div>
              )}
              {payment.bankReference && (
                <div className="dn-form-row">
                  <span className="dn-form-row__label">Bank Reference</span>
                  <span>{payment.bankReference}</span>
                </div>
              )}
              {linkedInvoice && (
                <>
                  <div className="dn-form-row">
                    <span className="dn-form-row__label">Linked Invoice</span>
                    <span>
                      {linkedInvoice.invoiceNumber ?? '—'} ·{' '}
                      {formatMoney(linkedInvoice.totalAmount, linkedInvoice.currency)}
                    </span>
                  </div>
                  <div className="dn-form-row">
                    <span className="dn-form-row__label">Invoice Status</span>
                    <span>{linkedInvoice.status}</span>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="pay-actions-bar">
            {canEvaluate && (
              <button type="button" className="btn btn--sm" onClick={handleEvaluate} disabled={actionLoading}>
                Evaluate Payment
              </button>
            )}
            {canMarkPaid && (
              <button
                type="button"
                className="btn btn--sm"
                onClick={() => setConfirmMarkPaid(true)}
                disabled={actionLoading}
              >
                Mark as Paid
              </button>
            )}
            {canCancel && !isTerminal && (
              <button
                type="button"
                className="btn btn--destructive btn--sm"
                onClick={() => setConfirmCancel(true)}
                disabled={actionLoading}
              >
                Cancel Payment
              </button>
            )}
          </div>
        </div>

        <div className="pay-panel">
          {isPending && (
            <>
              <h2 className="pay-panel__title">Approvals Center</h2>
              <ApprovalsPanel
                approvals={approvals}
                canApprove={canApprove}
                onApprove={setApproveTarget}
                onReject={setRejectTarget}
              />
            </>
          )}

          {(isScheduled || isTerminal || checks.length > 0) && (
            <>
              <h2 className="pay-panel__title" style={{ marginTop: isPending ? 24 : 0 }}>
                Checks Ledger
              </h2>
              <ChecksTable checks={checks} />
            </>
          )}

          {!isPending && !isScheduled && checks.length === 0 && !isTerminal && (
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
              Checks will appear here after check generation is approved and the payment is scheduled.
            </p>
          )}
        </div>
      </div>

      <ConfirmDialog
        id="confirm-cancel-payment"
        isOpen={confirmCancel}
        title="Cancel Payment"
        message="Are you sure you want to cancel this payment? This action cannot be undone."
        confirmLabel="Cancel Payment"
        destructive
        isLoading={actionLoading}
        onConfirm={handleCancel}
        onCancel={() => setConfirmCancel(false)}
      />

      <ConfirmDialog
        id="confirm-mark-paid"
        isOpen={confirmMarkPaid}
        title="Mark as Paid"
        message="Mark this payment as paid? Linked invoice lifecycle may be updated. Check statuses are not changed automatically."
        confirmLabel="Mark as Paid"
        isLoading={actionLoading}
        onConfirm={handleMarkPaid}
        onCancel={() => setConfirmMarkPaid(false)}
      />

      <ApproveApprovalModal
        isOpen={!!approveTarget}
        onClose={() => setApproveTarget(null)}
        onConfirm={handleApprove}
      />

      <RejectApprovalModal
        isOpen={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        onConfirm={handleReject}
      />
    </div>
  );
}
