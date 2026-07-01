export type CheckStatus = 'planned' | 'issued' | 'received' | 'cleared' | 'cancelled';

export interface Check {
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
  supplierName?: string | null;
  currency?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface EnrichedCheck extends Check {
  supplierName?: string;
  currency?: string;
}

export interface CalendarCheckItem {
  id: string;
  paymentId: string;
  checkNumber: string | null;
  amount: number;
  issueDate: string;
  expectedReceiptDate?: string | null;
  status: string;
}

export interface CheckCalendarEntry {
  receiptDate: string;
  totalAmount: number;
  checks: CalendarCheckItem[];
}

export interface NonWorkingDay {
  date: string;
  name: string | null;
  dayType: string;
}

export interface CheckCalendarResponse {
  entries: CheckCalendarEntry[];
  entriesByIssueDate: IssueDateEntry[];
  nonWorkingDays: NonWorkingDay[];
}

export interface DailyPayoutSummary {
  date: string;
  totalAmount: number;
  limit: number;
  percentUsed: number;
}

export interface IssueDateEntry {
  issueDate: string;
  totalAmount: number;
  checks: CalendarCheckItem[];
}

export interface CalendarCell {
  date: string;
  inMonth: boolean;
}

export interface CheckDetailResponse {
  check: Check;
  payment?: {
    id: string;
    supplierId: string;
    supplierName?: string;
    amount: number;
    currency: string;
    dueDate: string;
    status: string;
    paymentMethod: string;
  };
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

export function checkStatusLabel(status: CheckStatus | string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function buildMonthGrid(year: number, month: number): CalendarCell[] {
  const cells: CalendarCell[] = [];
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startOffset = (first.getDay() + 6) % 7;
  const cursor = new Date(year, month, 1 - startOffset);

  do {
    for (let i = 0; i < 7; i++) {
      cells.push({
        date: toIsoDate(cursor),
        inMonth: cursor.getMonth() === month,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
  } while (cursor <= last || cells.length % 7 !== 0);

  return cells;
}

export function getGridBounds(cells: CalendarCell[]): { dateFrom: string; dateTo: string } {
  return {
    dateFrom: cells[0]?.date ?? toIsoDate(new Date()),
    dateTo: cells[cells.length - 1]?.date ?? toIsoDate(new Date()),
  };
}

export function isoDayOfWeek(date: string): number {
  const d = new Date(`${date}T12:00:00`);
  const js = d.getDay();
  return js === 0 ? 7 : js;
}

export function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

export function buildEntriesByIssueDate(entries: CheckCalendarEntry[]): IssueDateEntry[] {
  const grouped = new Map<string, IssueDateEntry>();

  for (const entry of entries) {
    for (const check of entry.checks) {
      const issueDate = check.issueDate.slice(0, 10);
      const existing = grouped.get(issueDate) ?? { issueDate, totalAmount: 0, checks: [] };
      existing.totalAmount += check.amount;
      existing.checks.push(check);
      grouped.set(issueDate, existing);
    }
  }

  return [...grouped.values()].sort((a, b) => a.issueDate.localeCompare(b.issueDate));
}

export function issueDateTotalForLimit(
  entriesByIssueDate: IssueDateEntry[],
  date: string,
): number {
  const entry = entriesByIssueDate.find((item) => item.issueDate === date);
  if (!entry) return 0;
  return entry.checks
    .filter((check) => check.status !== 'cancelled')
    .reduce((sum, check) => sum + check.amount, 0);
}

export function splitSequenceLabel(
  paymentId: string,
  checkId: string,
  checks: CalendarCheckItem[],
): string | null {
  const samePayment = checks
    .filter((check) => check.paymentId === paymentId)
    .sort((a, b) => a.issueDate.localeCompare(b.issueDate) || a.id.localeCompare(b.id));
  if (samePayment.length <= 1) return null;
  const index = samePayment.findIndex((check) => check.id === checkId);
  if (index < 0) return null;
  return `Check ${index + 1} of ${samePayment.length}`;
}

export const CHECK_STATUS_DOT_CLASS: Record<string, string> = {
  planned: 'check-cal-dot--planned',
  issued: 'check-cal-dot--issued',
  received: 'check-cal-dot--received',
  cleared: 'check-cal-dot--cleared',
  cancelled: 'check-cal-dot--cancelled',
};

export async function fetchAllChecks(
  fetchPage: (offset: number, limit: number) => Promise<Check[]>,
  pageSize = 100,
): Promise<Check[]> {
  const all: Check[] = [];
  let offset = 0;
  for (;;) {
    const page = await fetchPage(offset, pageSize);
    all.push(...page);
    if (page.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}
