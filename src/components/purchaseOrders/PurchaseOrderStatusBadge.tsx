import { PO_STATUS_LABELS, type PurchaseOrderStatus } from '../../types/purchaseOrder';
import '../../components/purchaseOrders/PurchaseOrders.css';

interface PurchaseOrderStatusBadgeProps {
  status: PurchaseOrderStatus;
  title?: string;
  strikethrough?: boolean;
}

export function PurchaseOrderStatusBadge({ status, title, strikethrough }: PurchaseOrderStatusBadgeProps) {
  return (
    <span
      className={`po-status po-status--${status} ${strikethrough ? 'po-status--strikethrough' : ''}`}
      title={title}
    >
      {PO_STATUS_LABELS[status] ?? status}
    </span>
  );
}
