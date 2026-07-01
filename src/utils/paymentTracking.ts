import type { Payment, PaymentMethod } from '../types/payment';

export type PaymentTrackCategory = 'paid' | 'in_progress' | 'overdue';

export interface PaymentTrackFilters {
  supplierId: string;
  paymentMethod: PaymentMethod | 'all';
}

export interface PaymentTrackTotals {
  total: number;
  paid: number;
  inProgress: number;
  overdue: number;
  count: number;
}

const ACTIVE_STATUSES = new Set(['draft', 'pending_validation', 'scheduled']);

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function classifyPayment(payment: Payment, today = todayIsoDate()): PaymentTrackCategory | null {
  if (payment.status === 'cancelled') return null;
  if (payment.status === 'paid') return 'paid';
  if (payment.dueDate < today) return 'overdue';
  if (ACTIVE_STATUSES.has(payment.status)) return 'in_progress';
  return 'in_progress';
}

export function filterTrackPayments(
  payments: Payment[],
  filters: PaymentTrackFilters,
): Payment[] {
  return payments.filter((payment) => {
    if (payment.status === 'cancelled') return false;
    if (filters.supplierId !== 'all' && payment.supplierId !== filters.supplierId) return false;
    if (filters.paymentMethod !== 'all' && payment.paymentMethod !== filters.paymentMethod) {
      return false;
    }
    return true;
  });
}

export function computeTrackTotals(payments: Payment[], today = todayIsoDate()): PaymentTrackTotals {
  let total = 0;
  let paid = 0;
  let inProgress = 0;
  let overdue = 0;

  for (const payment of payments) {
    const bucket = classifyPayment(payment, today);
    if (!bucket) continue;
    total += payment.amount;
    if (bucket === 'paid') paid += payment.amount;
    else if (bucket === 'in_progress') inProgress += payment.amount;
    else overdue += payment.amount;
  }

  return { total, paid, inProgress, overdue, count: payments.length };
}

export function pct(part: number, whole: number): string {
  if (!whole) return '0%';
  return `${((part / whole) * 100).toFixed(1)}%`;
}

export interface MonthlyPaymentPoint {
  key: string;
  label: string;
  amount: number;
}

export function buildMonthlyPaymentTrend(
  payments: Payment[],
  months = 12,
  referenceDate = new Date(),
): MonthlyPaymentPoint[] {
  const points: MonthlyPaymentPoint[] = [];

  for (let i = months - 1; i >= 0; i -= 1) {
    const date = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - i, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const label = date.toLocaleDateString('en-US', { month: 'short' });
    points.push({ key, label, amount: 0 });
  }

  const indexByKey = new Map(points.map((point, index) => [point.key, index]));

  for (const payment of payments) {
    if (payment.status === 'cancelled') continue;
    const source = payment.status === 'paid' && payment.paidAt ? payment.paidAt : payment.dueDate;
    const monthKey = source.slice(0, 7);
    const index = indexByKey.get(monthKey);
    if (index == null) continue;
    points[index].amount += payment.amount;
  }

  return points;
}
