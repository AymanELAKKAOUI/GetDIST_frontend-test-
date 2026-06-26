export type PaymentMethod = 'check' | 'cash';
export type PaymentStatus = 'draft' | 'pending_validation' | 'scheduled' | 'paid' | 'cancelled';
export type CheckStatus = 'planned' | 'issued' | 'received' | 'cleared' | 'cancelled';
export type ApprovalType =
  | 'payment_reschedule'
  | 'check_generation'
  | 'check_split'
  | 'payment_status_change'
  | 'check_date_change';
export type ApprovalStatus =
  | 'draft'
  | 'pending_validation'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'expired';

export interface Payment {
  id: string;
  companyId: string;
  companyName?: string;
  supplierId: string;
  supplierName?: string;
  invoiceId: string | null;
  amount: number;
  currency: string;
  dueDate: string;
  deliveryDate: string | null;
  scheduledDate: string | null;
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  description?: string | null;
  externalReference?: string | null;
  bankReference: string | null;
  remainingBalance: number | null;
  paidAt: string | null;
}

export interface CheckRecord {
  id: string;
  companyId: string;
  paymentId: string;
  checkNumber: string | null;
  amount: number;
  issueDate: string;
  expectedReceiptDate: string | null;
  status: CheckStatus;
  agreedDepositDate: string | null;
  actualDepositDate: string | null;
}

export interface CheckProposalItem {
  amount: number;
  issueDate: string;
  expectedReceiptDate: string;
}

export interface RescheduleProposedValues {
  originalDate?: string;
  scheduledDate?: string;
  conflictType?: string;
  conflictName?: string;
}

export interface ApprovalRequestItem {
  id?: string;
  sequenceNumber?: number;
  proposedEntityType?: string;
  proposedValues: CheckProposalItem | RescheduleProposedValues | Record<string, unknown>;
}

export interface ApprovalRequest {
  id: string;
  companyId: string;
  entityType: string;
  entityId: string;
  approvalType: ApprovalType;
  status: ApprovalStatus;
  proposedValues: RescheduleProposedValues | Record<string, unknown>;
  reason?: string | null;
  items: ApprovalRequestItem[];
  history?: unknown[];
}

export interface PaymentDetailResponse {
  payment: Payment;
  checks: CheckRecord[];
  approvals: ApprovalRequest[];
}

export function formatDateDisplay(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export function formatMoney(amount: number | null | undefined, currency = 'MAD'): string {
  if (amount == null || Number.isNaN(amount)) return '—';
  return `${amount.toFixed(2)} ${currency}`;
}

export function paymentMethodLabel(method: PaymentMethod): string {
  return method === 'check' ? 'Check' : 'Cash';
}

export function statusDisplayLabel(status: PaymentStatus): string {
  switch (status) {
    case 'draft':
      return 'Draft';
    case 'pending_validation':
      return 'Awaiting Approval';
    case 'scheduled':
      return 'Scheduled';
    case 'paid':
      return 'Paid';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status;
  }
}

export function checkStatusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export async function fetchAllPayments(
  fetchPage: (offset: number, limit: number) => Promise<Payment[]>,
  pageSize = 100,
): Promise<Payment[]> {
  const all: Payment[] = [];
  let offset = 0;
  for (;;) {
    const page = await fetchPage(offset, pageSize);
    all.push(...page);
    if (page.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}
