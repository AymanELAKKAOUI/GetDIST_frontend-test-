import type { InvoiceStatus } from '../../types/invoice';
import { statusDisplayLabel } from '../../types/invoice';
import './Invoices.css';

interface InvoiceStatusBadgeProps {
  status: InvoiceStatus;
}

function badgeVariant(status: InvoiceStatus): string {
  switch (status) {
    case 'received':
    case 'pending_verification':
      return 'pending';
    case 'approved':
      return 'approved';
    case 'disputed':
      return 'disputed';
    case 'partially_paid':
      return 'partial';
    case 'paid':
      return 'paid';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'pending';
  }
}

export function InvoiceStatusBadge({ status }: InvoiceStatusBadgeProps) {
  return (
    <span className={`inv-note-status inv-note-status--${badgeVariant(status)}`}>
      {statusDisplayLabel(status)}
    </span>
  );
}
