import { apiClient } from './client';
import type { CompanyPolicy, UpdatePolicyPayload } from '../types/policy';

function mapPolicyRow(row: Record<string, unknown>): CompanyPolicy {
  const workingDaysRaw = row.working_days ?? row.workingDays;
  const workingDays = Array.isArray(workingDaysRaw) ? workingDaysRaw.map(Number) : [];

  return {
    id: String(row.id),
    companyId: String(row.company_id ?? row.companyId),
    splitThresholdAmount: Number(row.split_threshold_amount ?? row.splitThresholdAmount),
    maximumCheckAmount: Number(row.maximum_check_amount ?? row.maximumCheckAmount),
    dailyMaximumPayoutAmount: Number(row.daily_maximum_payout_amount ?? row.dailyMaximumPayoutAmount),
    checkIntervalDays: Number(row.check_interval_days ?? row.checkIntervalDays),
    issueNotificationLeadDays: Number(row.issue_notification_lead_days ?? row.issueNotificationLeadDays),
    receiptNotificationLeadDays: Number(row.receipt_notification_lead_days ?? row.receiptNotificationLeadDays),
    cashPreparationLeadDays: Number(row.cash_preparation_lead_days ?? row.cashPreparationLeadDays),
    approvalTimeoutHours: Number(row.approval_timeout_hours ?? row.approvalTimeoutHours),
    reschedulingStrategy: String(row.rescheduling_strategy ?? row.reschedulingStrategy) as CompanyPolicy['reschedulingStrategy'],
    splitStrategy: String(row.split_strategy ?? row.splitStrategy) as CompanyPolicy['splitStrategy'],
    workingDays,
    effectiveFrom:
      row.effective_from != null || row.effectiveFrom != null
        ? String(row.effective_from ?? row.effectiveFrom).slice(0, 10)
        : undefined,
  };
}

export function policyToUpdatePayload(policy: CompanyPolicy): UpdatePolicyPayload {
  return {
    splitThresholdAmount: policy.splitThresholdAmount,
    maximumCheckAmount: policy.maximumCheckAmount,
    dailyMaximumPayoutAmount: policy.dailyMaximumPayoutAmount,
    checkIntervalDays: policy.checkIntervalDays,
    issueNotificationLeadDays: policy.issueNotificationLeadDays,
    receiptNotificationLeadDays: policy.receiptNotificationLeadDays,
    cashPreparationLeadDays: policy.cashPreparationLeadDays,
    approvalTimeoutHours: policy.approvalTimeoutHours,
    reschedulingStrategy: policy.reschedulingStrategy,
    splitStrategy: policy.splitStrategy,
    workingDays: policy.workingDays,
    effectiveFrom: policy.effectiveFrom,
  };
}

export async function fetchActivePolicy(): Promise<CompanyPolicy | null> {
  try {
    const { data } = await apiClient.get<{ policy: Record<string, unknown> }>('/api/policies/active');
    return mapPolicyRow(data.policy);
  } catch {
    return null;
  }
}

export async function updateCompanyPolicy(payload: UpdatePolicyPayload): Promise<CompanyPolicy> {
  const { data } = await apiClient.put<{ policy: Record<string, unknown> }>('/api/policies', payload);
  return mapPolicyRow(data.policy);
}
