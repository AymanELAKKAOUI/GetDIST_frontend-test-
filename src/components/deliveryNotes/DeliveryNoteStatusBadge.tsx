import type { DeliveryNoteStatus } from '../../types/deliveryNote';
import { statusDisplayLabel } from '../../types/deliveryNote';
import './DeliveryNotes.css';

interface DeliveryNoteStatusBadgeProps {
  status: DeliveryNoteStatus;
}

export function DeliveryNoteStatusBadge({ status }: DeliveryNoteStatusBadgeProps) {
  const variant =
    status === 'verified' ? 'verified' : status === 'disputed' ? 'disputed' : 'received';

  return (
    <span className={`dn-note-status dn-note-status--${variant}`}>
      {statusDisplayLabel(status)}
    </span>
  );
}
