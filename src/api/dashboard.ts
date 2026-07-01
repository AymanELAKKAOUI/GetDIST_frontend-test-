import { apiClient } from './client';

export interface DirectionKpis {
  dpo: number | null;
  totalSupplierDebt: number;
  upcomingCashOutflows: {
    days7: number;
    days30: number;
    days90: number;
  };
  overdueInvoiceRate: number | null;
  supplierConcentration: Array<{
    id: string;
    name: string;
    totalAmount: number;
    share: number | null;
  }>;
}

export interface PaymentDashboardKpis {
  dueThisWeek: number;
  dueThisMonth: number;
  avgPaymentDelayDays: number;
}

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function mapDirectionKpis(raw: Record<string, unknown>): DirectionKpis {
  const outflows = (raw.upcoming_cash_outflows ?? raw.upcomingCashOutflows ?? {}) as Record<
    string,
    unknown
  >;
  const concentration = (raw.supplier_concentration ?? raw.supplierConcentration ?? []) as Array<
    Record<string, unknown>
  >;

  return {
    dpo: raw.dpo != null ? num(raw.dpo) : null,
    totalSupplierDebt: num(raw.total_supplier_debt ?? raw.totalSupplierDebt),
    upcomingCashOutflows: {
      days7: num(outflows.days_7 ?? outflows.days7),
      days30: num(outflows.days_30 ?? outflows.days30),
      days90: num(outflows.days_90 ?? outflows.days90),
    },
    overdueInvoiceRate:
      raw.overdue_invoice_rate != null || raw.overdueInvoiceRate != null
        ? num(raw.overdue_invoice_rate ?? raw.overdueInvoiceRate)
        : null,
    supplierConcentration: concentration.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      totalAmount: num(row.total_amount ?? row.totalAmount),
      share: row.share != null ? num(row.share) : null,
    })),
  };
}

function mapPaymentDashboardKpis(raw: Record<string, unknown>): PaymentDashboardKpis {
  return {
    dueThisWeek: num(raw.due_this_week ?? raw.dueThisWeek),
    dueThisMonth: num(raw.due_this_month ?? raw.dueThisMonth),
    avgPaymentDelayDays: num(raw.avg_payment_delay_days ?? raw.avgPaymentDelayDays),
  };
}

export async function fetchDirectionKpis(): Promise<DirectionKpis> {
  const { data } = await apiClient.get<{ kpis: Record<string, unknown> }>('/api/dashboard/direction');
  return mapDirectionKpis(data.kpis);
}

export async function fetchPaymentDashboardKpis(): Promise<PaymentDashboardKpis> {
  const { data } = await apiClient.get<{ kpis: Record<string, unknown> }>('/api/dashboard/payments');
  return mapPaymentDashboardKpis(data.kpis);
}
