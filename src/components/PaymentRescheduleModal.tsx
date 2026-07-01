import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { evaluatePayment, parseDailyPayoutLimitError } from '../api/payments';
import { getApiErrorMessage } from '../api/client';
import type { EvaluateCheckProposal } from '../types/paymentEvaluate';
import {
  buildInitialCheckProposals,
  type DailyPayoutLimitErrorDetails,
} from '../types/paymentEvaluate';
import { formatDateDisplay, formatMoney } from '../types/check';
import { Modal } from './ui/Modal';
import { useToast } from './ui/Toast';
import './checks/Checks.css';

interface PaymentRescheduleModalProps {
  isOpen: boolean;
  paymentId: string;
  currency: string;
  scheduledDate: string | null;
  dueDate: string;
  checkIntervalDays: number;
  limitError: DailyPayoutLimitErrorDetails;
  onClose: () => void;
  onSuccess: () => void;
}

export function PaymentRescheduleModal({
  isOpen,
  paymentId,
  currency,
  scheduledDate,
  dueDate,
  checkIntervalDays,
  limitError: initialError,
  onClose,
  onSuccess,
}: PaymentRescheduleModalProps) {
  const { showToast } = useToast();
  const [limitError, setLimitError] = useState(initialError);
  const [proposals, setProposals] = useState<EvaluateCheckProposal[]>(() =>
    buildInitialCheckProposals(initialError, { scheduledDate, dueDate }, checkIntervalDays),
  );
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLimitError(initialError);
    setProposals(
      buildInitialCheckProposals(initialError, { scheduledDate, dueDate }, checkIntervalDays),
    );
  }, [isOpen, initialError, scheduledDate, dueDate, checkIntervalDays]);

  const combinedTotal = limitError.currentTotal + limitError.proposedAmount;
  const barPercent = Math.min(130, (combinedTotal / limitError.limit) * 100);
  const barClass =
    combinedTotal > limitError.limit
      ? 'pay-reschedule-bar__fill pay-reschedule-bar__fill--over'
      : combinedTotal > limitError.limit * 0.8
        ? 'pay-reschedule-bar__fill pay-reschedule-bar__fill--warn'
        : 'pay-reschedule-bar__fill pay-reschedule-bar__fill--ok';

  const retryEvaluate = useCallback(
    async (nextProposals: EvaluateCheckProposal[]) => {
      setSubmitting(true);
      try {
        await evaluatePayment(paymentId, nextProposals);
        showToast('Payment evaluated successfully.');
        onSuccess();
        onClose();
      } catch (error) {
        const nextLimitError = parseDailyPayoutLimitError(error);
        if (nextLimitError) {
          setLimitError(nextLimitError.details);
          setProposals((prev) => {
            const rebuilt = prev.length === nextLimitError.details.checkCount
              ? [...prev]
              : buildInitialCheckProposals(
                  nextLimitError.details,
                  { scheduledDate, dueDate },
                  checkIntervalDays,
                );
            rebuilt[nextLimitError.details.checkIndex] = {
              ...rebuilt[nextLimitError.details.checkIndex],
              issueDate: nextLimitError.details.exceededDate,
            };
            return rebuilt;
          });
          return;
        }
        showToast(getApiErrorMessage(error, 'Failed to evaluate payment.'), 'error');
      } finally {
        setSubmitting(false);
      }
    },
    [paymentId, showToast, onSuccess, onClose, scheduledDate, dueDate, checkIntervalDays],
  );

  const acceptSuggestion = (date: string) => {
    const next = [...proposals];
    next[limitError.checkIndex] = { ...next[limitError.checkIndex], issueDate: date };
    setProposals(next);
    void retryEvaluate(next);
  };

  return (
    <Modal
      id="payment-reschedule-modal"
      title={`Daily Payout Limit Exceeded on ${formatDateDisplay(limitError.exceededDate)}`}
      isOpen={isOpen}
      onClose={onClose}
      maxWidth={560}
    >
      <div className="pay-reschedule">
        <p className="pay-reschedule__intro">
          The proposed check would exceed the company daily payout limit. Choose a recommended date
          or adjust the split schedule below.
        </p>

        <div className="pay-reschedule-stats">
          <div>
            <span className="pay-reschedule-stats__label">Already scheduled</span>
            <strong>{formatMoney(limitError.currentTotal, currency)}</strong>
          </div>
          <div>
            <span className="pay-reschedule-stats__label">This check</span>
            <strong>{formatMoney(limitError.proposedAmount, currency)}</strong>
          </div>
          <div>
            <span className="pay-reschedule-stats__label">Daily limit</span>
            <strong>{formatMoney(limitError.limit, currency)}</strong>
          </div>
        </div>

        <div className="pay-reschedule-bar">
          <div className={barClass} style={{ width: `${barPercent}%` }} />
          <div
            className="pay-reschedule-bar__limit-mark"
            style={{ left: `${Math.min(100, (limitError.limit / combinedTotal) * 100)}%` }}
          />
        </div>
        <div className="pay-reschedule-bar__caption">
          Combined {formatMoney(combinedTotal, currency)} vs limit {formatMoney(limitError.limit, currency)}
        </div>

        {limitError.checkCount > 1 && (
          <div className="pay-reschedule-splits">
            <div className="pay-reschedule-splits__title">Split schedule</div>
            {proposals.map((proposal, index) => (
              <div
                key={index}
                className={`pay-reschedule-split ${index === limitError.checkIndex ? 'pay-reschedule-split--conflict' : ''}`}
              >
                <span>
                  Check {index + 1} of {limitError.checkCount}
                </span>
                <span>{formatDateDisplay(proposal.issueDate)}</span>
                {index === limitError.checkIndex && (
                  <span className="pay-reschedule-split__badge">
                    <AlertTriangle size={12} />
                    Over limit
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="pay-reschedule-suggestions">
          <div className="pay-reschedule-suggestions__title">Recommended dates</div>
          <div className="pay-reschedule-suggestions__chips">
            {limitError.suggestions.length === 0 ? (
              <p className="pay-reschedule-suggestions__empty">No alternative dates found nearby.</p>
            ) : (
              limitError.suggestions.map((suggestion) => (
                <button
                  key={suggestion.date}
                  type="button"
                  className="pay-reschedule-chip"
                  disabled={submitting}
                  onClick={() => acceptSuggestion(suggestion.date)}
                >
                  {formatDateDisplay(suggestion.date)}
                  <span className="pay-reschedule-chip__meta">
                    {formatMoney(suggestion.remainingCapacity, currency)} free
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="modal__footer" style={{ marginTop: 20, paddingTop: 16 }}>
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}
