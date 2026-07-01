import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, CreditCard, Eye, EyeOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import { fetchDirectionKpis, fetchPaymentDashboardKpis, type DirectionKpis, type PaymentDashboardKpis } from '../../api/dashboard';
import { fetchCompanyDisplayName } from '../../api/company';
import { apiClient, getApiErrorMessage } from '../../api/client';
import { mapPaymentRow } from '../../api/payments';
import { useAuth } from '../../context/AuthContext';
import type { Payment, PaymentMethod } from '../../types/payment';
import { fetchAllPayments, formatDateDisplay, formatMoney } from '../../types/payment';
import {
  buildMonthlyPaymentTrend,
  classifyPayment,
  computeTrackTotals,
  filterTrackPayments,
  pct,
  todayIsoDate,
  type PaymentTrackCategory,
  type PaymentTrackFilters,
} from '../../utils/paymentTracking';
import { Spinner } from '../ui/Spinner';
import { PaymentMethodBadge, PaymentStatusBadge } from '../payments/PaymentStatusBadge';
import '../payments/Payments.css';
import './PaymentTrackingDashboard.css';

const AMOUNTS_HIDDEN_KEY = 'payDashHideAmounts';
const TABLE_LIMIT = 25;

const PIE_COLORS = {
  paid: '#22c55e',
  inProgress: '#3b82f6',
  overdue: '#ef4444',
} as const;

interface AppliedFilters extends PaymentTrackFilters {}

interface DraftFilters extends PaymentTrackFilters {}

function formatTodayBadge(): string {
  const now = new Date();
  return formatDateDisplay(now.toISOString().slice(0, 10));
}

function AmountText({
  amount,
  currency,
  hidden,
  className,
}: {
  amount: number;
  currency: string;
  hidden: boolean;
  className?: string;
}) {
  return (
    <span className={className}>
      {hidden ? '•••' : formatMoney(amount, currency)}
    </span>
  );
}

function DoughnutChart({
  paid,
  inProgress,
  overdue,
  hidden,
}: {
  paid: number;
  inProgress: number;
  overdue: number;
  hidden: boolean;
}) {
  const total = paid + inProgress + overdue;
  if (total <= 0) {
    return <div className="pay-dash-chart-empty">No payment amounts to display</div>;
  }

  const segments = [
    { label: 'Paid', value: paid, color: PIE_COLORS.paid },
    { label: 'In progress', value: inProgress, color: PIE_COLORS.inProgress },
    { label: 'Overdue', value: overdue, color: PIE_COLORS.overdue },
  ].filter((segment) => segment.value > 0);

  let cumulative = 0;
  const gradient = segments
    .map((segment) => {
      const start = (cumulative / total) * 100;
      cumulative += segment.value;
      const end = (cumulative / total) * 100;
      return `${segment.color} ${start}% ${end}%`;
    })
    .join(', ');

  return (
    <div className="pay-dash-doughnut-wrap">
      <div className="pay-dash-doughnut" style={{ background: `conic-gradient(${gradient})` }} />
      <div className="pay-dash-legend">
        {segments.map((segment) => (
          <div key={segment.label} className="pay-dash-legend__item">
            <span className="pay-dash-legend__dot" style={{ background: segment.color }} />
            <span>
              {segment.label}:{' '}
              {hidden ? '•••' : `${segment.value.toLocaleString('en-US')} MAD (${pct(segment.value, total)})`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LineChart({
  points,
  hidden,
}: {
  points: Array<{ label: string; amount: number }>;
  hidden: boolean;
}) {
  const max = Math.max(...points.map((point) => point.amount), 1);
  const width = 600;
  const height = 220;
  const padding = { top: 16, right: 12, bottom: 8, left: 12 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const coords = points.map((point, index) => {
    const x = padding.left + (index / Math.max(points.length - 1, 1)) * innerW;
    const y = padding.top + innerH - (point.amount / max) * innerH;
    return { x, y, point };
  });

  const linePath = coords.map((coord, index) => `${index === 0 ? 'M' : 'L'} ${coord.x} ${coord.y}`).join(' ');
  const areaPath = `${linePath} L ${coords[coords.length - 1]?.x ?? padding.left} ${padding.top + innerH} L ${coords[0]?.x ?? padding.left} ${padding.top + innerH} Z`;

  return (
    <div>
      <svg className="pay-dash-line-chart" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="payDashLineFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255, 107, 0, 0.3)" />
            <stop offset="50%" stopColor="rgba(255, 107, 0, 0.1)" />
            <stop offset="100%" stopColor="rgba(255, 107, 0, 0)" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
          const y = padding.top + innerH * (1 - tick);
          return (
            <line
              key={tick}
              x1={padding.left}
              y1={y}
              x2={width - padding.right}
              y2={y}
              stroke="rgba(46,46,46,0.5)"
              strokeWidth="1"
            />
          );
        })}
        <path d={areaPath} fill="url(#payDashLineFill)" />
        <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinejoin="round" />
        {coords.map((coord) => (
          <circle
            key={coord.point.label}
            cx={coord.x}
            cy={coord.y}
            r="5"
            fill="var(--accent)"
            stroke="#ffffff"
            strokeWidth="2"
          />
        ))}
      </svg>
      <div className="pay-dash-line-chart__labels">
        {points.map((point) => (
          <span key={point.label}>{point.label}</span>
        ))}
      </div>
      {hidden ? (
        <p className="pay-dash-chart-card__sub" style={{ marginTop: 8 }}>
          Amounts hidden — chart shape only
        </p>
      ) : null}
    </div>
  );
}

function TrackStatusCell({ payment, today }: { payment: Payment; today: string }) {
  const bucket = classifyPayment(payment, today);
  if (bucket === 'overdue') {
    return <span className="pay-dash-track-badge pay-dash-track-badge--overdue">Overdue</span>;
  }
  if (bucket === 'in_progress') {
    return <span className="pay-dash-track-badge pay-dash-track-badge--progress">In progress</span>;
  }
  return <PaymentStatusBadge status={payment.status} />;
}

function PaymentTableSection({
  title,
  payments,
  category,
  today,
  hidden,
  currency,
}: {
  title: string;
  payments: Payment[];
  category: PaymentTrackCategory;
  today: string;
  hidden: boolean;
  currency: string;
}) {
  const rows = payments.filter((payment) => classifyPayment(payment, today) === category);
  const visibleRows = rows.slice(0, TABLE_LIMIT);

  return (
    <section className="pay-dash-section">
      <div className="pay-dash-section__header">
        <h2>{title}</h2>
        <span className="pay-dash-section__count">{rows.length}</span>
      </div>
      <div className="pay-dash-table-card">
        <div className="pay-dash-table-wrap">
          <table className="pay-dash-table">
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Amount</th>
                <th>Company</th>
                <th>Payment method</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 20 }}>
                    No payments
                  </td>
                </tr>
              ) : (
                visibleRows.map((payment) => (
                  <tr key={payment.id}>
                    <td>
                      <Link to={`/payments/${payment.id}`} className="pay-dash-table__link">
                        <strong>{payment.supplierName ?? 'Supplier'}</strong>
                      </Link>
                    </td>
                    <td>
                      <AmountText
                        amount={payment.amount}
                        currency={payment.currency || currency}
                        hidden={hidden}
                        className="pay-dash-amount"
                      />
                    </td>
                    <td>{payment.companyName ?? '—'}</td>
                    <td>
                      <PaymentMethodBadge method={payment.paymentMethod} />
                    </td>
                    <td>
                      <TrackStatusCell payment={payment} today={today} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {rows.length > TABLE_LIMIT ? (
        <Link to="/payments" className="pay-dash-footer-link">
          View all {rows.length} in Payments →
        </Link>
      ) : null}
    </section>
  );
}

function DirectionStrip({
  direction,
  paymentKpis,
  hidden,
}: {
  direction: DirectionKpis | null;
  paymentKpis: PaymentDashboardKpis | null;
  hidden: boolean;
}) {
  if (!direction && !paymentKpis) return null;

  return (
    <div className="pay-dash-direction">
      {direction ? (
        <div className="pay-dash-direction__item">
          <div className="pay-dash-direction__label">Outstanding supplier debt</div>
          <div className="pay-dash-direction__value">
            {hidden ? '•••' : formatMoney(direction.totalSupplierDebt)}
          </div>
        </div>
      ) : null}
      {direction ? (
        <div className="pay-dash-direction__item">
          <div className="pay-dash-direction__label">Cash outflows (7 / 30 days)</div>
          <div className="pay-dash-direction__value">
            {hidden
              ? '•••'
              : `${formatMoney(direction.upcomingCashOutflows.days7)} / ${formatMoney(direction.upcomingCashOutflows.days30)}`}
          </div>
        </div>
      ) : null}
      {paymentKpis ? (
        <div className="pay-dash-direction__item">
          <div className="pay-dash-direction__label">Due this week / month</div>
          <div className="pay-dash-direction__value">
            {paymentKpis.dueThisWeek} / {paymentKpis.dueThisMonth} payments
          </div>
        </div>
      ) : null}
      {paymentKpis ? (
        <div className="pay-dash-direction__item">
          <div className="pay-dash-direction__label">Avg. payment delay</div>
          <div className="pay-dash-direction__value">
            {paymentKpis.avgPaymentDelayDays.toFixed(1)} days
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function PaymentTrackingDashboard() {
  const { user, hasPermission } = useAuth();
  const canViewDashboard = hasPermission('dashboard.view');
  const today = todayIsoDate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [directionKpis, setDirectionKpis] = useState<DirectionKpis | null>(null);
  const [paymentKpis, setPaymentKpis] = useState<PaymentDashboardKpis | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);

  const [draftFilters, setDraftFilters] = useState<DraftFilters>({
    supplierId: 'all',
    paymentMethod: 'all',
  });
  const [appliedFilters, setAppliedFilters] = useState<AppliedFilters>({
    supplierId: 'all',
    paymentMethod: 'all',
  });

  const [hideAmounts, setHideAmounts] = useState(() => {
    try {
      return localStorage.getItem(AMOUNTS_HIDDEN_KEY) === '1';
    } catch {
      return false;
    }
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchAllPayments(async (offset, limit) => {
        const { data } = await apiClient.get<{ payments: Record<string, unknown>[] }>('/api/payments', {
          params: { limit, offset },
        });
        return data.payments.map(mapPaymentRow);
      });
      setPayments(list);

      if (user?.companyId) {
        fetchCompanyDisplayName(user.companyId, list).then(setCompanyName);
      }

      const extras: Promise<void>[] = [];
      if (canViewDashboard) {
        extras.push(
          fetchDirectionKpis()
            .then(setDirectionKpis)
            .catch(() => setDirectionKpis(null)),
          fetchPaymentDashboardKpis()
            .then(setPaymentKpis)
            .catch(() => setPaymentKpis(null)),
        );
      }
      await Promise.all(extras);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to load payment dashboard.'));
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }, [canViewDashboard, user?.companyId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const toggleHideAmounts = () => {
    setHideAmounts((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(AMOUNTS_HIDDEN_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const supplierOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const payment of payments) {
      if (!map.has(payment.supplierId)) {
        map.set(payment.supplierId, payment.supplierName ?? payment.supplierId);
      }
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [payments]);

  const filteredPayments = useMemo(
    () => filterTrackPayments(payments, appliedFilters),
    [payments, appliedFilters],
  );

  const totals = useMemo(() => computeTrackTotals(filteredPayments, today), [filteredPayments, today]);
  const currency = filteredPayments.find((payment) => payment.currency)?.currency ?? 'MAD';
  const monthlyTrend = useMemo(() => buildMonthlyPaymentTrend(filteredPayments), [filteredPayments]);

  const kpiCards = [
    { label: 'Total', amount: totals.total, sub: '100%', tone: 'total' as const },
    { label: 'Paid', amount: totals.paid, sub: pct(totals.paid, totals.total), tone: 'paid' as const },
    {
      label: 'In progress',
      amount: totals.inProgress,
      sub: pct(totals.inProgress, totals.total),
      tone: 'progress' as const,
    },
    {
      label: 'Overdue',
      amount: totals.overdue,
      sub: pct(totals.overdue, totals.total),
      tone: 'overdue' as const,
    },
  ];

  const applyFilters = () => setAppliedFilters({ ...draftFilters });
  const resetFilters = () => {
    const reset: DraftFilters = { supplierId: 'all', paymentMethod: 'all' };
    setDraftFilters(reset);
    setAppliedFilters(reset);
  };

  if (loading) {
    return (
      <div className="pay-dash-loading">
        <Spinner size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="pay-dash">
        <p style={{ color: 'var(--error)' }}>{error}</p>
        <button type="button" className="btn btn--ghost" onClick={() => void loadData()}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={`pay-dash${hideAmounts ? ' pay-dash--amount-hidden' : ''}`} id="payment-tracking-dashboard">
      <header className="pay-dash__header">
        <div>
          <div className="pay-dash__title-row">
            <CreditCard size={28} aria-hidden />
            Payment tracking
            <span className="pay-dash__badge">Management</span>
          </div>
          <p className="pay-dash__subtitle">
            Supplier payment overview{companyName ? ` — ${companyName}` : ''}
          </p>
        </div>
        <div className="pay-dash__header-actions">
          <button
            type="button"
            className={`pay-dash__eye-btn${hideAmounts ? ' pay-dash__eye-btn--active' : ''}`}
            onClick={toggleHideAmounts}
            title={hideAmounts ? 'Show amounts' : 'Hide amounts'}
            aria-pressed={hideAmounts}
          >
            {hideAmounts ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
          <div className="pay-dash__date-badge">
            <CalendarDays size={16} aria-hidden />
            <span>{formatTodayBadge()}</span>
          </div>
        </div>
      </header>

      {canViewDashboard ? (
        <DirectionStrip direction={directionKpis} paymentKpis={paymentKpis} hidden={hideAmounts} />
      ) : null}

      <div className="pay-dash-total-card">
        <div className="pay-dash-total-card__label">Total payments</div>
        <div className="pay-dash-total-card__amount pay-dash-amount">
          {hideAmounts ? '•••' : formatMoney(totals.total, currency)}
        </div>
        <div className="pay-dash-total-card__meta">
          <span>
            {totals.count} payment{totals.count !== 1 ? 's' : ''}
          </span>
          <span>
            Average{' '}
            <span className="pay-dash-total-card__stat pay-dash-amount">
              {hideAmounts ? '•••' : formatMoney(totals.count ? totals.total / totals.count : 0, currency)}
            </span>
          </span>
        </div>
      </div>

      <div className="pay-dash-kpi-grid">
        {kpiCards.map((kpi) => (
          <div key={kpi.label} className={`pay-dash-kpi pay-dash-kpi--${kpi.tone}`}>
            <div className="pay-dash-kpi__label">{kpi.label}</div>
            <div className="pay-dash-kpi__amount pay-dash-amount">
              {hideAmounts ? '•••' : formatMoney(kpi.amount, currency)}
            </div>
            <div className="pay-dash-kpi__sub pay-dash-kpi-sub">{hideAmounts ? '•••' : kpi.sub}</div>
          </div>
        ))}
      </div>

      <div className="pay-dash-charts">
        <div className="pay-dash-chart-card">
          <div className="pay-dash-chart-card__title">
            Status breakdown
            <span className="pay-dash-chart-card__sub">by payment amount</span>
          </div>
          <DoughnutChart
            paid={totals.paid}
            inProgress={totals.inProgress}
            overdue={totals.overdue}
            hidden={hideAmounts}
          />
        </div>
        <div className="pay-dash-chart-card">
          <div className="pay-dash-chart-card__title">
            Payment trend
            <span className="pay-dash-chart-card__sub">last 12 months</span>
          </div>
          <LineChart points={monthlyTrend} hidden={hideAmounts} />
        </div>
      </div>

      <div className="pay-dash-filters">
        <div className="pay-dash-filter">
          <label htmlFor="pay-dash-filter-supplier">Supplier</label>
          <select
            id="pay-dash-filter-supplier"
            value={draftFilters.supplierId}
            onChange={(e) => setDraftFilters((prev) => ({ ...prev, supplierId: e.target.value }))}
          >
            <option value="all">All</option>
            {supplierOptions.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
        </div>
        <div className="pay-dash-filter">
          <label htmlFor="pay-dash-filter-method">Payment method</label>
          <select
            id="pay-dash-filter-method"
            value={draftFilters.paymentMethod}
            onChange={(e) =>
              setDraftFilters((prev) => ({
                ...prev,
                paymentMethod: e.target.value as PaymentMethod | 'all',
              }))
            }
          >
            <option value="all">All</option>
            <option value="check">Check</option>
            <option value="cash">Cash</option>
          </select>
        </div>
        <div className="pay-dash-filter-actions">
          <button type="button" className="btn" onClick={applyFilters}>
            Apply
          </button>
          <button type="button" className="btn btn--ghost" onClick={resetFilters}>
            Reset
          </button>
        </div>
      </div>

      <PaymentTableSection
        title="In progress"
        payments={filteredPayments}
        category="in_progress"
        today={today}
        hidden={hideAmounts}
        currency={currency}
      />
      <PaymentTableSection
        title="Overdue"
        payments={filteredPayments}
        category="overdue"
        today={today}
        hidden={hideAmounts}
        currency={currency}
      />
      <PaymentTableSection
        title="Paid history"
        payments={filteredPayments}
        category="paid"
        today={today}
        hidden={hideAmounts}
        currency={currency}
      />
    </div>
  );
}
