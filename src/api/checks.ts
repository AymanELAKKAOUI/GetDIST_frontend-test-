import { apiClient } from './client';
import { mapPaymentRow } from './payments';
import type {
  Check,
  CheckCalendarResponse,
  CheckDetailResponse,
  CheckStatus,
  EnrichedCheck,
} from '../types/check';
import type { Payment } from '../types/payment';
import type { Supplier } from '../types/supplier';

export function mapCheckRow(row: Record<string, unknown>): Check {
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
    status: String(row.status) as CheckStatus,
    agreedDepositDate:
      row.agreed_deposit_date != null || row.agreedDepositDate != null
        ? String(row.agreed_deposit_date ?? row.agreedDepositDate).slice(0, 10)
        : null,
    actualDepositDate:
      row.actual_deposit_date != null || row.actualDepositDate != null
        ? String(row.actual_deposit_date ?? row.actualDepositDate).slice(0, 10)
        : null,
    supplierName: row.supplier_name != null ? String(row.supplier_name) : row.supplierName != null ? String(row.supplierName) : undefined,
    currency: row.currency != null ? String(row.currency) : undefined,
    createdAt: row.created_at != null ? String(row.created_at) : row.createdAt != null ? String(row.createdAt) : undefined,
    updatedAt: row.updated_at != null ? String(row.updated_at) : row.updatedAt != null ? String(row.updatedAt) : undefined,
  };
}

export function enrichChecks(
  checks: Check[],
  paymentsById: Map<string, Payment>,
  suppliersById: Map<string, string>,
): EnrichedCheck[] {
  return checks.map((check) => {
    const payment = paymentsById.get(check.paymentId);
    const supplierName =
      check.supplierName ??
      payment?.supplierName ??
      (payment?.supplierId ? suppliersById.get(payment.supplierId) : undefined);
    return {
      ...check,
      supplierName: supplierName ?? undefined,
      currency: check.currency ?? payment?.currency ?? 'MAD',
    };
  });
}

export interface ListChecksParams {
  status?: CheckStatus;
  issueDateFrom?: string;
  issueDateTo?: string;
  expectedReceiptDateFrom?: string;
  expectedReceiptDateTo?: string;
  limit?: number;
  offset?: number;
}

export async function listChecks(params: ListChecksParams = {}): Promise<Check[]> {
  const { data } = await apiClient.get<{ checks: Record<string, unknown>[] }>('/api/checks', { params });
  return data.checks.map(mapCheckRow);
}

export async function fetchCheckCalendar(dateFrom: string, dateTo: string): Promise<CheckCalendarResponse> {
  const { data } = await apiClient.get<CheckCalendarResponse>('/api/checks/calendar', {
    params: { dateFrom, dateTo },
  });
  return {
    entries: data.entries ?? [],
    entriesByIssueDate: data.entriesByIssueDate ?? [],
    nonWorkingDays: data.nonWorkingDays ?? [],
  };
}

export async function fetchDailyPayouts(dateFrom: string, dateTo: string) {
  const { data } = await apiClient.get<{ payouts: import('../types/check').DailyPayoutSummary[] }>(
    '/api/checks/daily-payouts',
    { params: { dateFrom, dateTo } },
  );
  return data.payouts;
}

export async function fetchCheckDetail(checkId: string): Promise<CheckDetailResponse> {
  const { data } = await apiClient.get<{
    check: Record<string, unknown>;
    payment?: Record<string, unknown>;
  }>(`/api/checks/${checkId}`);
  const check = mapCheckRow(data.check);

  if (data.payment) {
    const row = data.payment;
    return {
      check,
      payment: {
        id: String(row.id ?? check.paymentId),
        supplierId: String(row.supplierId ?? row.supplier_id ?? ''),
        supplierName:
          row.supplierName != null
            ? String(row.supplierName)
            : row.supplier_name != null
              ? String(row.supplier_name)
              : check.supplierName ?? undefined,
        amount: Number(row.amount ?? row.payment_amount),
        currency: String(row.currency ?? check.currency ?? 'MAD'),
        dueDate: String(row.dueDate ?? row.due_date ?? '').slice(0, 10),
        status: String(row.status ?? row.payment_status),
        paymentMethod: String(row.paymentMethod ?? row.payment_method),
      },
    };
  }

  return { check };
}

export async function issueCheck(checkId: string, checkNumber?: string): Promise<Check> {
  const { data } = await apiClient.post<{ check: Record<string, unknown> }>(
    `/api/checks/${checkId}/issue`,
    checkNumber ? { checkNumber } : {},
  );
  return mapCheckRow(data.check);
}

export async function receiveCheck(checkId: string, agreedDepositDate?: string): Promise<Check> {
  const { data } = await apiClient.post<{ check: Record<string, unknown> }>(
    `/api/checks/${checkId}/receive`,
    agreedDepositDate ? { agreedDepositDate } : {},
  );
  return mapCheckRow(data.check);
}

export async function clearCheck(checkId: string, actualDepositDate?: string): Promise<Check> {
  const { data } = await apiClient.post<{ check: Record<string, unknown> }>(
    `/api/checks/${checkId}/clear`,
    actualDepositDate ? { actualDepositDate } : {},
  );
  return mapCheckRow(data.check);
}

export async function cancelCheck(checkId: string): Promise<Check> {
  const { data } = await apiClient.post<{ check: Record<string, unknown> }>(
    `/api/checks/${checkId}/cancel`,
  );
  return mapCheckRow(data.check);
}

export async function loadPaymentAndSupplierMaps(isSupplierPortalUser: boolean): Promise<{
  paymentsById: Map<string, Payment>;
  suppliersById: Map<string, string>;
}> {
  const paymentsById = new Map<string, Payment>();
  const suppliersById = new Map<string, string>();

  const tasks: Promise<void>[] = [];

  if (!isSupplierPortalUser) {
    tasks.push(
      apiClient.get<{ suppliers: Supplier[] }>('/api/suppliers').then(({ data }) => {
        for (const supplier of data.suppliers) {
          suppliersById.set(supplier.id, supplier.name);
        }
      }),
    );
  }

  tasks.push(
    (async () => {
      let offset = 0;
      for (;;) {
        const { data } = await apiClient.get<{ payments: Record<string, unknown>[] }>('/api/payments', {
          params: { limit: 100, offset },
        });
        for (const row of data.payments) {
          const payment = mapPaymentRow(row);
          paymentsById.set(payment.id, payment);
        }
        if (data.payments.length < 100) break;
        offset += 100;
      }
    })(),
  );

  await Promise.all(tasks);

  for (const payment of paymentsById.values()) {
    if (payment.supplierName && payment.supplierId) {
      suppliersById.set(payment.supplierId, payment.supplierName);
    }
  }

  return { paymentsById, suppliersById };
}
