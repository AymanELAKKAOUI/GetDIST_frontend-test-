import { useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { ChevronLeft, ChevronRight, List, RefreshCw, X } from 'lucide-react';
import {
  enrichChecks,
  fetchCheckCalendar,
  fetchDailyPayouts,
  listChecks,
  loadPaymentAndSupplierMaps,
} from '../api/checks';
import { fetchActivePolicy } from '../api/policies';
import { useAuth } from '../context/AuthContext';
import type { CompanyPolicy } from '../types/policy';
import { utilizationBarClass } from '../types/paymentEvaluate';
import type {
  CalendarCheckItem,
  CheckCalendarEntry,
  DailyPayoutSummary,
  EnrichedCheck,
  NonWorkingDay,
} from '../types/check';
import {
  buildMonthGrid,
  CHECK_STATUS_DOT_CLASS,
  formatDateDisplay,
  formatMoney,
  getGridBounds,
  isoDayOfWeek,
  monthLabel,
  splitSequenceLabel,
  toIsoDate,
} from '../types/check';
import { useToast } from './ui/Toast';
import { CheckStatusBadge } from './payments/PaymentStatusBadge';
import { CheckDetailModal } from './checks/CheckDetailModal';
import './checks/Checks.css';
import './payments/Payments.css';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function todayIso(): string {
  return toIsoDate(new Date());
}

function isWeekendDay(date: string, workingDays: number[] | null): boolean {
  const dow = isoDayOfWeek(date);
  if (workingDays && workingDays.length > 0) {
    return !workingDays.includes(dow);
  }
  return dow === 6 || dow === 7;
}

function uniqueStatuses(checks: CalendarCheckItem[]): string[] {
  return [...new Set(checks.map((check) => check.status))];
}

export function CheckCalendar() {
  const { showToast } = useToast();
  const { isSupplierPortalUser, hasAnyPermission } = useAuth();

  const canViewUtilization =
    !isSupplierPortalUser &&
    hasAnyPermission(['check.view', 'check.create', 'policy.manage', 'treasury.view']);

  const today = todayIso();
  const initial = new Date();
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<CheckCalendarEntry[]>([]);
  const [nonWorkingDays, setNonWorkingDays] = useState<NonWorkingDay[]>([]);
  const [dailyPayouts, setDailyPayouts] = useState<DailyPayoutSummary[]>([]);
  const [policy, setPolicy] = useState<CompanyPolicy | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [drawerChecks, setDrawerChecks] = useState<EnrichedCheck[]>([]);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [selectedCheck, setSelectedCheck] = useState<EnrichedCheck | null>(null);

  const gridCells = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);
  const gridBounds = useMemo(() => getGridBounds(gridCells), [gridCells]);

  const nonWorkingByDate = useMemo(
    () => new Map(nonWorkingDays.map((day) => [day.date, day])),
    [nonWorkingDays],
  );

  const entriesByReceiptDate = useMemo(
    () => new Map(entries.map((entry) => [entry.receiptDate, entry])),
    [entries],
  );

  const payoutsByDate = useMemo(
    () => new Map(dailyPayouts.map((row) => [row.date, row])),
    [dailyPayouts],
  );

  const workingDays = useMemo(() => {
    if (isSupplierPortalUser || !policy?.workingDays?.length) return null;
    return policy.workingDays;
  }, [isSupplierPortalUser, policy]);

  const workingDayCount = useMemo(
    () =>
      gridCells.filter(
        (cell) =>
          cell.inMonth && !isWeekendDay(cell.date, workingDays) && !nonWorkingByDate.has(cell.date),
      ).length,
    [gridCells, workingDays, nonWorkingByDate],
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const calendarPromise = fetchCheckCalendar(gridBounds.dateFrom, gridBounds.dateTo);
      const policyPromise =
        !isSupplierPortalUser && hasAnyPermission(['policy.manage', 'treasury.view', 'check.view'])
          ? fetchActivePolicy()
          : Promise.resolve(null);
      const payoutsPromise = canViewUtilization
        ? fetchDailyPayouts(gridBounds.dateFrom, gridBounds.dateTo).catch(() => [])
        : Promise.resolve([]);

      const [calendar, policyResult, payouts] = await Promise.all([
        calendarPromise,
        policyPromise,
        payoutsPromise,
      ]);

      setEntries(calendar.entries);
      setNonWorkingDays(calendar.nonWorkingDays);
      setPolicy(policyResult);
      setDailyPayouts(payouts);
    } catch {
      showToast('Failed to load calendar.', 'error');
    } finally {
      setLoading(false);
    }
  }, [canViewUtilization, gridBounds.dateFrom, gridBounds.dateTo, hasAnyPermission, isSupplierPortalUser, showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!selectedDate) {
      setDrawerChecks([]);
      return;
    }

    let cancelled = false;
    setDrawerLoading(true);

    (async () => {
      try {
        const raw = await listChecks({
          expectedReceiptDateFrom: selectedDate,
          expectedReceiptDateTo: selectedDate,
          limit: 100,
          offset: 0,
        });
        const { paymentsById, suppliersById } = await loadPaymentAndSupplierMaps(isSupplierPortalUser);
        if (!cancelled) {
          setDrawerChecks(enrichChecks(raw, paymentsById, suppliersById));
        }
      } catch {
        if (!cancelled) {
          setDrawerChecks([]);
        }
      } finally {
        if (!cancelled) setDrawerLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedDate, isSupplierPortalUser]);

  const goPrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
    setSelectedDate(null);
  };

  const goNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
    setSelectedDate(null);
  };

  const goToday = () => {
    const now = new Date();
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    setSelectedDate(today);
  };

  const selectedReceiptEntry = selectedDate ? entriesByReceiptDate.get(selectedDate) : null;
  const drawerCalendarChecks = selectedReceiptEntry?.checks ?? [];

  return (
    <div
      id="check-calendar-page"
      className={`check-calendar-layout ${selectedDate ? 'check-calendar-layout--drawer-open' : ''}`}
    >
      <div className="check-calendar-main">
        <div className="page-header">
          <div>
            <h1 className="page-header__title">Calendar</h1>
            <p className="page-header__subtitle check-calendar-month-title">
              {monthLabel(viewYear, viewMonth)}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <NavLink to="/checks" className="btn btn--ghost btn--sm">
              <List size={16} />
              Ledger
            </NavLink>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => fetchData()} disabled={loading}>
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
        </div>

        <div className="check-calendar-toolbar">
          <div className="check-calendar-toolbar__left">
            <span className="check-calendar-filter-pill">Filter</span>
            <span className="check-calendar-day-count">{workingDayCount} working days</span>
          </div>

          <div className="check-calendar-nav">
            <button type="button" className="btn btn--ghost btn--icon" onClick={goPrevMonth} aria-label="Previous month">
              <ChevronLeft size={18} />
            </button>
            <button type="button" className="check-calendar-today-btn" onClick={goToday}>
              Today,{' '}
              {new Date(today).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </button>
            <button type="button" className="btn btn--ghost btn--icon" onClick={goNextMonth} aria-label="Next month">
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="check-calendar-view-tabs">
            <span className="check-calendar-view-tabs__item check-calendar-view-tabs__item--active">
              Receipt view
            </span>
          </div>
        </div>

        {loading ? (
          <div className="check-calendar-grid check-calendar-grid--loading">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="check-calendar-cell skeleton" />
            ))}
          </div>
        ) : (
          <div className="check-calendar-grid-wrap">
            <div className="check-calendar-weekdays">
              {WEEKDAY_LABELS.map((label) => (
                <div key={label} className="check-calendar-weekday">
                  {label}
                </div>
              ))}
            </div>
            <div className="check-calendar-grid">
              {gridCells.map((cell) => {
                const holiday = nonWorkingByDate.get(cell.date);
                const weekend = isWeekendDay(cell.date, workingDays);
                const receiptEntry = entriesByReceiptDate.get(cell.date);
                const payout = payoutsByDate.get(cell.date);
                const percentUsed = canViewUtilization ? (payout?.percentUsed ?? 0) : 0;
                const utilClass = utilizationBarClass(percentUsed);
                const isToday = cell.date === today;
                const isSelected = cell.date === selectedDate;
                const statusDots = receiptEntry ? uniqueStatuses(receiptEntry.checks) : [];

                return (
                  <button
                    key={cell.date}
                    type="button"
                    className={[
                      'check-calendar-cell',
                      !cell.inMonth && 'check-calendar-cell--outside',
                      weekend && 'check-calendar-cell--weekend',
                      holiday && 'check-calendar-cell--holiday',
                      isToday && 'check-calendar-cell--today',
                      isSelected && 'check-calendar-cell--selected',
                      receiptEntry && 'check-calendar-cell--has-checks',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    title={holiday?.name ?? undefined}
                    onClick={() => setSelectedDate(cell.date)}
                  >
                    <span className="check-calendar-cell__day">{Number(cell.date.slice(8, 10))}</span>

                    {statusDots.length > 0 && (
                      <div className="check-calendar-cell__dots">
                        {statusDots.map((status) => (
                          <span
                            key={status}
                            className={`check-cal-dot ${CHECK_STATUS_DOT_CLASS[status] ?? 'check-cal-dot--planned'}`}
                            title={status}
                          />
                        ))}
                      </div>
                    )}

                    {holiday?.name && (
                      <span className="check-calendar-cell__holiday">{holiday.name}</span>
                    )}

                    {receiptEntry && (
                      <span className="check-calendar-cell__amount">
                        {formatMoney(receiptEntry.totalAmount, 'MAD')}
                      </span>
                    )}

                    {canViewUtilization && (
                      <div className="check-cal-util" title={`Issue-date utilization: ${percentUsed.toFixed(0)}%`}>
                        <div className={`check-cal-util__fill ${utilClass}`} style={{ width: `${Math.min(percentUsed, 100)}%` }} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {selectedDate && (
        <aside className="check-calendar-drawer">
          <div className="check-calendar-drawer__header">
            <div>
              <div className="check-calendar-drawer__label">Expected receipt date</div>
              <div className="check-calendar-drawer__date">{selectedDate}</div>
            </div>
            <button type="button" className="btn--icon" onClick={() => setSelectedDate(null)} aria-label="Close panel">
              <X size={18} />
            </button>
          </div>

          {nonWorkingByDate.get(selectedDate) && (
            <div className="check-calendar-drawer__holiday">
              Public holiday: {nonWorkingByDate.get(selectedDate)?.name ?? 'Non-working day'}
            </div>
          )}

          {drawerLoading ? (
            <p className="check-calendar-drawer__empty">Loading checks…</p>
          ) : drawerChecks.length > 0 ? (
            <div className="check-calendar-drawer__list">
              {drawerChecks.map((check) => {
                const splitLabel = splitSequenceLabel(check.paymentId, check.id, drawerCalendarChecks);
                return (
                  <button
                    key={check.id}
                    type="button"
                    className="check-calendar-drawer__item"
                    onClick={() => setSelectedCheck(check)}
                  >
                    <div className="check-calendar-drawer__item-top">
                      <span>{check.checkNumber ?? 'Pending'}</span>
                      <CheckStatusBadge status={check.status} />
                    </div>
                    <div className="check-calendar-drawer__item-amount">
                      {formatMoney(check.amount, check.currency)}
                    </div>
                    <div className="check-calendar-drawer__item-meta">
                      {check.supplierName ?? 'Supplier'}
                      {' · Issue '}
                      {formatDateDisplay(check.issueDate)}
                    </div>
                    {splitLabel && <div className="check-calendar-drawer__split-badge">{splitLabel}</div>}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="check-calendar-drawer__empty">No checks expected on this date.</p>
          )}
        </aside>
      )}

      <CheckDetailModal
        isOpen={selectedCheck != null}
        checkId={selectedCheck?.id ?? null}
        initialCheck={selectedCheck}
        onClose={() => setSelectedCheck(null)}
        onUpdated={fetchData}
      />
    </div>
  );
}
