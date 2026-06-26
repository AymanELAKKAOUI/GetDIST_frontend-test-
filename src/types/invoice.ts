export type InvoiceStatus =
  | 'received'
  | 'pending_verification'
  | 'approved'
  | 'disputed'
  | 'partially_paid'
  | 'paid'
  | 'cancelled';

export interface InvoiceLineItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
}

export interface Invoice {
  id: string;
  companyId: string;
  supplierId: string;
  purchaseOrderId: string | null;
  deliveryNoteId: string | null;
  invoiceNumber: string | null;
  invoiceDate: string;
  dueDate: string;
  receptionDate: string | null;
  status: InvoiceStatus;
  lineItems: InvoiceLineItem[];
  subtotalAmount: number | null;
  taxAmount: number | null;
  totalAmount: number | null;
  currency: string;
  createdByUserId: string | null;
  respondedByUserId?: string | null;
  respondedAt?: string | null;
  declineReason: string | null;
  pdfFilePath: string | null;
  originalFilename: string | null;
  createdAt?: string;
}

export const ACTIVE_INVOICE_STATUSES: InvoiceStatus[] = [
  'received',
  'pending_verification',
  'approved',
  'partially_paid',
  'paid',
];

export function findActiveInvoice(invoices: Invoice[] | undefined): Invoice | undefined {
  return invoices?.find((i) => ACTIVE_INVOICE_STATUSES.includes(i.status));
}

export function findRejectedInvoice(invoices: Invoice[] | undefined): Invoice | undefined {
  return invoices?.find((i) => i.status === 'disputed');
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
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

export function formatMoney(amount: number | null | undefined, currency = 'MAD'): string {
  if (amount == null || Number.isNaN(amount)) return '—';
  return `${amount.toFixed(2)} ${currency}`;
}

export function statusDisplayLabel(status: InvoiceStatus): string {
  switch (status) {
    case 'received':
    case 'pending_verification':
      return 'Pending Review';
    case 'approved':
      return 'Accepted';
    case 'disputed':
      return 'Rejected';
    case 'partially_paid':
      return 'Partially Paid';
    case 'paid':
      return 'Paid';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status;
  }
}

export function emptyLineItem(): InvoiceLineItem {
  return { productName: '', quantity: 1, unitPrice: 0, taxRate: 20 };
}

export function calculateLineSubtotal(item: InvoiceLineItem): number {
  return item.quantity * item.unitPrice;
}

export function calculateLineTax(item: InvoiceLineItem): number {
  return calculateLineSubtotal(item) * (item.taxRate / 100);
}

export function calculateLineTotal(item: InvoiceLineItem): number {
  return calculateLineSubtotal(item) + calculateLineTax(item);
}

export function calculateInvoiceTotals(items: InvoiceLineItem[]): {
  subtotal: number;
  taxAmount: number;
  total: number;
} {
  let subtotal = 0;
  let taxAmount = 0;
  for (const item of items) {
    subtotal += calculateLineSubtotal(item);
    taxAmount += calculateLineTax(item);
  }
  return { subtotal, taxAmount, total: subtotal + taxAmount };
}

export async function fetchAllInvoices(
  fetchPage: (offset: number, limit: number) => Promise<Invoice[]>,
  pageSize = 100,
): Promise<Invoice[]> {
  const all: Invoice[] = [];
  let offset = 0;
  for (;;) {
    const page = await fetchPage(offset, pageSize);
    all.push(...page);
    if (page.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}
