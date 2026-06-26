import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  cancelCheck,
  clearCheck,
  fetchCheckDetail,
  issueCheck,
  receiveCheck,
} from '../../api/checks';
import { getApiErrorMessage } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import type { CheckDetailResponse, EnrichedCheck } from '../../types/check';
import { formatDateDisplay, formatMoney } from '../../types/check';
import { Modal } from '../ui/Modal';
import { Spinner } from '../ui/Spinner';
import { useToast } from '../ui/Toast';
import { CheckStatusBadge } from '../payments/PaymentStatusBadge';
import {
  CancelCheckDialog,
  DateCheckModal,
  IssueCheckModal,
} from './CheckActionModals';
import './Checks.css';
import '../deliveryNotes/DeliveryNotes.css';
import '../payments/Payments.css';

interface CheckDetailModalProps {
  isOpen: boolean;
  checkId: string | null;
  initialCheck?: EnrichedCheck | null;
  onClose: () => void;
  onUpdated: () => void;
}

export function CheckDetailModal({
  isOpen,
  checkId,
  initialCheck,
  onClose,
  onUpdated,
}: CheckDetailModalProps) {
  const { showToast } = useToast();
  const { hasPermission } = useAuth();
  const canIssue = hasPermission('check.issue');

  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<CheckDetailResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showIssue, setShowIssue] = useState(false);
  const [showReceive, setShowReceive] = useState(false);
  const [showClear, setShowClear] = useState(false);
  const [showCancel, setShowCancel] = useState(false);

  const loadDetail = useCallback(async () => {
    if (!checkId || !isOpen) return;
    setLoading(true);
    try {
      const data = await fetchCheckDetail(checkId);
      setDetail(data);
    } catch {
      showToast('Check not found.', 'error');
      onClose();
    } finally {
      setLoading(false);
    }
  }, [checkId, isOpen, onClose, showToast]);

  useEffect(() => {
    if (isOpen && checkId) {
      loadDetail();
    } else {
      setDetail(null);
    }
  }, [isOpen, checkId, loadDetail]);

  const check = detail?.check;
  const payment = detail?.payment;
  const supplierName = payment?.supplierName ?? initialCheck?.supplierName;
  const currency = payment?.currency ?? initialCheck?.currency ?? 'MAD';

  const refreshAfterAction = async () => {
    await loadDetail();
    onUpdated();
  };

  const handleIssue = async (checkNumber?: string) => {
    if (!checkId) return;
    setSubmitting(true);
    try {
      await issueCheck(checkId, checkNumber);
      showToast('Check issued.');
      setShowIssue(false);
      await refreshAfterAction();
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Failed to issue check.'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReceive = async (agreedDepositDate?: string) => {
    if (!checkId) return;
    setSubmitting(true);
    try {
      await receiveCheck(checkId, agreedDepositDate);
      showToast('Check marked as received.');
      setShowReceive(false);
      await refreshAfterAction();
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Failed to mark check as received.'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClear = async (actualDepositDate?: string) => {
    if (!checkId) return;
    setSubmitting(true);
    try {
      await clearCheck(checkId, actualDepositDate);
      showToast('Check cleared.');
      setShowClear(false);
      await refreshAfterAction();
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Failed to clear check.'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!checkId) return;
    setSubmitting(true);
    try {
      await cancelCheck(checkId);
      showToast('Check cancelled.');
      setShowCancel(false);
      await refreshAfterAction();
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Failed to cancel check.'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const canCancel = check && check.status !== 'cancelled' && check.status !== 'cleared';
  const showIssueBtn = canIssue && check?.status === 'planned';
  const showReceiveBtn = canIssue && check?.status === 'issued';
  const showClearBtn = canIssue && check?.status === 'received';

  return (
    <>
      <Modal
        id="check-detail-modal"
        title="Check Details"
        isOpen={isOpen}
        onClose={onClose}
        maxWidth={640}
      >
        {loading || !check ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
            <Spinner size={28} />
          </div>
        ) : (
          <>
            <div className="check-detail-header">
              <div>
                <div className="check-detail-header__number">
                  {check.checkNumber ?? 'Pending'}
                </div>
                <div className="check-detail-header__amount">
                  {formatMoney(check.amount, currency)}
                </div>
              </div>
              <CheckStatusBadge status={check.status} />
            </div>

            <div className="dn-form-grid">
              <div className="dn-form-row">
                <span className="dn-form-row__label">Supplier</span>
                <span>{supplierName ?? '—'}</span>
              </div>
              <div className="dn-form-row">
                <span className="dn-form-row__label">Issue Date</span>
                <span>{formatDateDisplay(check.issueDate)}</span>
              </div>
              <div className="dn-form-row">
                <span className="dn-form-row__label">Expected Receipt</span>
                <span>{formatDateDisplay(check.expectedReceiptDate)}</span>
              </div>
              <div className="dn-form-row">
                <span className="dn-form-row__label">Agreed Deposit</span>
                <span>{formatDateDisplay(check.agreedDepositDate)}</span>
              </div>
              <div className="dn-form-row">
                <span className="dn-form-row__label">Actual Deposit</span>
                <span>{formatDateDisplay(check.actualDepositDate)}</span>
              </div>
              {payment && (
                <div className="dn-form-row">
                  <span className="dn-form-row__label">Linked Payment</span>
                  <Link to={`/payments/${payment.id}`} className="inv-sent-link" onClick={onClose}>
                    {formatMoney(payment.amount, payment.currency)} · {payment.status}
                  </Link>
                </div>
              )}
            </div>

            {(showIssueBtn || showReceiveBtn || showClearBtn || (canCancel && canIssue)) && (
              <div className="pay-actions-bar">
                {showIssueBtn && (
                  <button type="button" className="btn btn--sm" onClick={() => setShowIssue(true)}>
                    Issue Check
                  </button>
                )}
                {showReceiveBtn && (
                  <button type="button" className="btn btn--sm" onClick={() => setShowReceive(true)}>
                    Mark Received
                  </button>
                )}
                {showClearBtn && (
                  <button type="button" className="btn btn--sm" onClick={() => setShowClear(true)}>
                    Clear Check
                  </button>
                )}
                {canCancel && canIssue && (
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => setShowCancel(true)}>
                    Cancel Check
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </Modal>

      <IssueCheckModal
        isOpen={showIssue}
        onClose={() => setShowIssue(false)}
        onSubmit={handleIssue}
        submitting={submitting}
      />
      <DateCheckModal
        isOpen={showReceive}
        title="Mark Check Received"
        description="Confirm that the supplier has received this check."
        fieldLabel="Agreed deposit date"
        submitLabel="Mark Received"
        onClose={() => setShowReceive(false)}
        onSubmit={handleReceive}
        submitting={submitting}
      />
      <DateCheckModal
        isOpen={showClear}
        title="Clear Check"
        description="Mark this check as cleared after bank deposit."
        fieldLabel="Actual deposit date"
        submitLabel="Clear Check"
        onClose={() => setShowClear(false)}
        onSubmit={handleClear}
        submitting={submitting}
      />
      <CancelCheckDialog
        isOpen={showCancel}
        onClose={() => setShowCancel(false)}
        onConfirm={handleCancel}
        submitting={submitting}
      />
    </>
  );
}
