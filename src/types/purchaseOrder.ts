export interface PurchaseOrderLineItem {
  productName: string;
  quantity: number;
  unitPrice: number;
}

export type PurchaseOrderStatus =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'sent'
  | 'accepted'
  | 'declined'
  | 'partially_delivered'
  | 'fully_delivered'
  | 'closed'
  | 'cancelled';

export interface PurchaseOrder {
  id: string;
  companyId: string;
  supplierId: string;
  purchaseOrderNumber: string;
  orderDate: string;
  status: PurchaseOrderStatus;
  lineItems: PurchaseOrderLineItem[];
  totalAmount: number;
  currency: string;
  approvalDate: string | null;
  expectedDeliveryDate: string | null;
  actualDeliveryDate: string | null;
  createdByUserId: string | null;
  respondedByUserId: string | null;
  respondedAt: string | null;
  declineReason: string | null;
}

export function normalizePurchaseOrder(raw: PurchaseOrder): PurchaseOrder {
  return {
    ...raw,
    lineItems: Array.isArray(raw.lineItems) ? raw.lineItems : [],
    totalAmount: Number(raw.totalAmount),
  };
}

export function emptyLineItem(): PurchaseOrderLineItem {
  return { productName: '', quantity: 1, unitPrice: 0 };
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function suggestPurchaseOrderNumber(): string {
  const year = new Date().getFullYear();
  const suffix = String(Math.floor(Math.random() * 900) + 100);
  return `BC-${year}-${suffix}`;
}

export function calculateLineTotal(item: PurchaseOrderLineItem): number {
  return item.quantity * item.unitPrice;
}

export function calculateGrandTotal(items: PurchaseOrderLineItem[]): number {
  return items.reduce((sum, item) => sum + calculateLineTotal(item), 0);
}

export function formatCurrencyAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDateDisplay(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export function formatDateTimeDisplay(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const PO_STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  approved: 'Approved',
  sent: 'Sent',
  accepted: 'Accepted',
  declined: 'Declined',
  partially_delivered: 'Partially Delivered',
  fully_delivered: 'Fully Delivered',
  closed: 'Closed',
  cancelled: 'Cancelled',
};
