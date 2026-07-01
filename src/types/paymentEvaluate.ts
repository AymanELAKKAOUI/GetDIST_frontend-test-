export interface EvaluateCheckProposal {
  issueDate: string;
  expectedReceiptDate?: string;
}

export interface AlternativeDateSuggestion {
  date: string;
  remainingCapacity: number;
}

export interface DailyPayoutLimitErrorDetails {
  companyId?: string;
  paymentId?: string;
  exceededDate: string;
  proposedAmount: number;
  currentTotal: number;
  limit: number;
  combinedAmount?: number;
  checkIndex: number;
  checkCount: number;
  suggestions: AlternativeDateSuggestion[];
}

export interface DailyPayoutLimitError {
  error: 'DAILY_PAYOUT_LIMIT_EXCEEDED';
  message: string;
  details: DailyPayoutLimitErrorDetails;
}

export function isDailyPayoutLimitError(data: unknown): data is DailyPayoutLimitError {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as DailyPayoutLimitError).error === 'DAILY_PAYOUT_LIMIT_EXCEEDED' &&
    typeof (data as DailyPayoutLimitError).details?.exceededDate === 'string'
  );
}

export function utilizationBarClass(percentUsed: number): string {
  if (percentUsed > 100) return 'check-cal-util--over';
  if (percentUsed > 80) return 'check-cal-util--warn';
  return 'check-cal-util--ok';
}

export function addDaysIso(date: string, days: number): string {
  const cursor = new Date(`${date}T12:00:00`);
  cursor.setDate(cursor.getDate() + days);
  const y = cursor.getFullYear();
  const m = String(cursor.getMonth() + 1).padStart(2, '0');
  const d = String(cursor.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function buildInitialCheckProposals(
  error: DailyPayoutLimitErrorDetails,
  payment: { scheduledDate: string | null; dueDate: string },
  checkIntervalDays = 2,
): EvaluateCheckProposal[] {
  const count = error.checkCount || 1;
  const base = payment.scheduledDate ?? payment.dueDate;
  return Array.from({ length: count }, (_, index) => ({
    issueDate:
      index === error.checkIndex ? error.exceededDate : addDaysIso(base, index * checkIntervalDays),
  }));
}
