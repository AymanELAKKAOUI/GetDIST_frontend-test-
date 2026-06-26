import type { PaymentMethod, PaymentStatus } from '../../types/payment';
import { paymentMethodLabel, statusDisplayLabel } from '../../types/payment';
import './Payments.css';

interface PaymentStatusBadgeProps {
  status: PaymentStatus;
}

export function PaymentStatusBadge({ status }: PaymentStatusBadgeProps) {
  const variant =
    status === 'draft'
      ? 'draft'
      : status === 'pending_validation'
        ? 'pending'
        : status === 'scheduled'
          ? 'scheduled'
          : status === 'paid'
            ? 'paid'
            : 'cancelled';

  return (
    <span className={`pay-status-badge pay-status-badge--${variant}`}>
      {statusDisplayLabel(status)}
    </span>
  );
}

interface PaymentMethodBadgeProps {
  method: PaymentMethod;
}

export function PaymentMethodBadge({ method }: PaymentMethodBadgeProps) {
  return (
    <span className={`pay-method-badge pay-method-badge--${method}`}>
      {paymentMethodLabel(method)}
    </span>
  );
}

interface CheckStatusBadgeProps {
  status: string;
}

export function CheckStatusBadge({ status }: CheckStatusBadgeProps) {
  const normalized = ['planned', 'issued', 'received', 'cleared', 'cancelled'].includes(status)
    ? status
    : 'planned';
  return (
    <span className={`check-status-badge check-status-badge--${normalized}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}
