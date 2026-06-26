import { apiClient } from './client';
import type {
  ApprovalRequest,
  ApprovalRequestItem,
  CheckProposalItem,
  CheckRecord,
  Payment,
  PaymentDetailResponse,
  RescheduleProposedValues,
} from '../types/payment';

function parseJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === 'object') return value as T;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export function mapPaymentRow(row: Record<string, unknown>): Payment {
  return {
    id: String(row.id),
    companyId: String(row.company_id ?? row.companyId),
    companyName:
      row.company_name != null
        ? String(row.company_name)
        : row.companyName != null
          ? String(row.companyName)
          : undefined,
    supplierId: String(row.supplier_id ?? row.supplierId),
    supplierName: row.supplier_name != null ? String(row.supplier_name) : row.supplierName != null ? String(row.supplierName) : undefined,
    invoiceId: row.invoice_id != null || row.invoiceId != null ? String(row.invoice_id ?? row.invoiceId) : null,
    amount: Number(row.amount),
    currency: String(row.currency),
    dueDate: String(row.due_date ?? row.dueDate).slice(0, 10),
    deliveryDate: row.delivery_date != null || row.deliveryDate != null ? String(row.delivery_date ?? row.deliveryDate).slice(0, 10) : null,
    scheduledDate: row.scheduled_date != null || row.scheduledDate != null ? String(row.scheduled_date ?? row.scheduledDate).slice(0, 10) : null,
    paymentMethod: String(row.payment_method ?? row.paymentMethod) as Payment['paymentMethod'],
    status: String(row.status) as Payment['status'],
    description: row.description != null ? String(row.description) : null,
    externalReference: row.external_reference != null ? String(row.external_reference) : row.externalReference != null ? String(row.externalReference) : null,
    bankReference: row.bank_reference != null || row.bankReference != null ? String(row.bank_reference ?? row.bankReference) : null,
    remainingBalance: row.remaining_balance != null || row.remainingBalance != null ? Number(row.remaining_balance ?? row.remainingBalance) : null,
    paidAt: row.paid_at != null || row.paidAt != null ? String(row.paid_at ?? row.paidAt) : null,
  };
}

function mapCheckRow(row: Record<string, unknown>): CheckRecord {
  return {
    id: String(row.id),
    companyId: String(row.company_id ?? row.companyId),
    paymentId: String(row.payment_id ?? row.paymentId),
    checkNumber: row.check_number != null || row.checkNumber != null ? String(row.check_number ?? row.checkNumber) : null,
    amount: Number(row.amount),
    issueDate: String(row.issue_date ?? row.issueDate).slice(0, 10),
    expectedReceiptDate:
      row.expected_receipt_date != null || row.expectedReceiptDate != null
        ? String(row.expected_receipt_date ?? row.expectedReceiptDate).slice(0, 10)
        : null,
    status: String(row.status) as CheckRecord['status'],
    agreedDepositDate:
      row.agreed_deposit_date != null || row.agreedDepositDate != null
        ? String(row.agreed_deposit_date ?? row.agreedDepositDate).slice(0, 10)
        : null,
    actualDepositDate:
      row.actual_deposit_date != null || row.actualDepositDate != null
        ? String(row.actual_deposit_date ?? row.actualDepositDate).slice(0, 10)
        : null,
  };
}

function mapApprovalItem(raw: Record<string, unknown>): ApprovalRequestItem {
  return {
    id: raw.id != null ? String(raw.id) : undefined,
    sequenceNumber: raw.sequence_number != null ? Number(raw.sequence_number) : raw.sequenceNumber != null ? Number(raw.sequenceNumber) : undefined,
    proposedEntityType: raw.proposed_entity_type != null ? String(raw.proposed_entity_type) : raw.proposedEntityType != null ? String(raw.proposedEntityType) : undefined,
    proposedValues: parseJson(raw.proposed_values ?? raw.proposedValues, {}),
  };
}

function mapApprovalRow(row: Record<string, unknown>): ApprovalRequest {
  const proposedValues = parseJson<RescheduleProposedValues | Record<string, unknown>>(
    row.proposed_values ?? row.proposedValues,
    {},
  );
  const rawItems = row.items;
  let items: ApprovalRequestItem[] = [];
  if (Array.isArray(rawItems)) {
    items = rawItems.map((item) => mapApprovalItem(item as Record<string, unknown>));
  }

  return {
    id: String(row.id),
    companyId: String(row.company_id ?? row.companyId),
    entityType: String(row.entity_type ?? row.entityType),
    entityId: String(row.entity_id ?? row.entityId),
    approvalType: String(row.approval_type ?? row.approvalType) as ApprovalRequest['approvalType'],
    status: String(row.status) as ApprovalRequest['status'],
    proposedValues,
    reason: row.reason != null ? String(row.reason) : null,
    items,
    history: parseJson(row.history, []),
  };
}

export function normalizePaymentDetail(data: {
  payment: Record<string, unknown>;
  checks: Record<string, unknown>[];
  approvals: Record<string, unknown>[];
}): PaymentDetailResponse {
  return {
    payment: mapPaymentRow(data.payment),
    checks: data.checks.map(mapCheckRow),
    approvals: data.approvals.map(mapApprovalRow),
  };
}

export async function fetchPaymentDetail(paymentId: string): Promise<PaymentDetailResponse> {
  const { data } = await apiClient.get<{
    payment: Record<string, unknown>;
    checks: Record<string, unknown>[];
    approvals: Record<string, unknown>[];
  }>(`/api/payments/${paymentId}`);
  return normalizePaymentDetail(data);
}

export async function updatePaymentDraft(
  paymentId: string,
  payload: {
    amount?: number;
    dueDate?: string;
    deliveryDate?: string | null;
    scheduledDate?: string | null;
    description?: string | null;
    externalReference?: string | null;
    bankReference?: string | null;
    invoiceId?: string | null;
  },
): Promise<void> {
  await apiClient.patch(`/api/payments/${paymentId}`, payload);
}

export async function evaluatePayment(paymentId: string): Promise<void> {
  await apiClient.post(`/api/payments/${paymentId}/evaluate`);
}

export async function cancelPayment(paymentId: string): Promise<void> {
  await apiClient.post(`/api/payments/${paymentId}/cancel`);
}

export async function markPaymentPaid(paymentId: string): Promise<Payment> {
  const { data } = await apiClient.post<{ payment: Record<string, unknown> }>(
    `/api/payments/${paymentId}/mark-paid`,
  );
  return mapPaymentRow(data.payment);
}

export async function approveApprovalRequest(approvalRequestId: string, comment?: string): Promise<void> {
  await apiClient.post(`/api/approvals/${approvalRequestId}/approve`, comment ? { comment } : {});
}

export async function rejectApprovalRequest(approvalRequestId: string, reason: string): Promise<void> {
  await apiClient.post(`/api/approvals/${approvalRequestId}/reject`, { reason });
}

export function getCheckProposalItems(approval: ApprovalRequest): CheckProposalItem[] {
  if (approval.items.length > 0) {
    return approval.items
      .filter((item) => item.proposedEntityType === 'check' || approval.approvalType === 'check_generation')
      .map((item) => item.proposedValues as CheckProposalItem)
      .filter((item) => item.amount != null && item.issueDate != null);
  }
  return [];
}

export function getRescheduleValues(approval: ApprovalRequest): RescheduleProposedValues {
  return approval.proposedValues as RescheduleProposedValues;
}
