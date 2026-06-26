import { useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { AlertTriangle, ChevronLeft, ChevronRight, List, RefreshCw, X } from 'lucide-react';
import {
  fetchCheckCalendar,
  loadPaymentAndSupplierMaps,
} from '../../api/checks';
import { fetchActivePolicy } from '../../api/policies';
import { useAuth } from '../../context/AuthContext';
import type { CompanyPolicy } from '../../types/policy';
import type { CalendarCheckItem, CheckCalendarEntry, EnrichedCheck, NonWorkingDay } from '../../types/check';
import {
  buildEntriesByIssueDate,
  buildMonthGrid,
  formatDateDisplay,
  formatMoney,
  getGridBounds,
  isoDayOfWeek,
  issueDateTotalForLimit,
  monthLabel,
  toIsoDate,
} from '../../types/check';
import { useToast } from '../ui/Toast';
import { CheckStatusBadge } from '../payments/PaymentStatusBadge';
import { CheckDetailModal } from './CheckDetailModal';
import './Checks.css';
import '../payments/Payments.css';

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

export function CheckCalendarPage() {
  const { showToast } = useToast();
  const { isSupplierPortalUser, hasAnyPermission } = useAuth();

  const today = todayIso();
  const initial = new Date();
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<CheckCalendarEntry[]>([]);
  const [nonWorkingDays, setNonWorkingDays] = useState<NonWorkingDay[]>([]);
  const [policy, setPolicy] = useState<CompanyPolicy | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedCheck, setSelectedCheck] = useState<EnrichedCheck | null>(null);
  const [paymentMaps, setPaymentMaps] = useState<{
    paymentsById: Map<string, import('../../types/payment').Payment>;
    suppliersById: Map<string, string>;
  } | null>(null);

  const gridCells = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);
  const gridBounds = useMemo(() => getGridBounds(gridCells), [gridCells]);
  const entriesByIssueDate = useMemo(() => buildEntriesByIssueDate(entries), [entries]);

  const nonWorkingByDate = useMemo(
    () => new Map(nonWorkingDays.map((day) => [day.date, day])),
    [nonWorkingDays],
  );

  const entriesByReceiptDate = useMemo(
    () => new Map(entries.map((entry) => [entry.receiptDate, entry])),
    [entries],
  );

  const workingDays = useMemo(() => {
    if (isSupplierPortalUser || !policy?.workingDays?.length) return null;
    return policy.workingDays;
  }, [isSupplierPortalUser, policy]);

  const dailyLimit = !isSupplierPortalUser ? policy?.dailyMaximumPayoutAmount : undefined;

  const workingDayCount = useMemo(
    () => gridCells.filter((cell) => cell.inMonth && !isWeekendDay(cell.date, workingDays) && !nonWorkingByDate.has(cell.date)).length,
    [gridCells, workingDays, nonWorkingByDate],
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [calendar, policyResult, maps] = await Promise.all([
        fetchCheckCalendar(gridBounds.dateFrom, gridBounds.dateTo),
        !isSupplierPortalUser && hasAnyPermission(['policy.manage', 'treasury.view'])
          ? fetchActivePolicy()
          : Promise.resolve(null),
        loadPaymentAndSupplierMaps(isSupplierPortalUser),
      ]);

      setEntries(calendar.entries);
      setNonWorkingDays(calendar.nonWorkingDays);
      setPolicy(policyResult);
      setPaymentMaps(maps);
    } catch {
      showToast('Failed to load calendar.', 'error');
    } finally {
      setLoading(false);
    }
  }, [gridBounds.dateFrom, gridBounds.dateTo, hasAnyPermission, isSupplierPortalUser, showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  const selectedEntry = selectedDate ? entriesByReceiptDate.get(selectedDate) : null;

  const enrichCalendarCheck = (item: CalendarCheckItem): EnrichedCheck => {
    const payment = paymentMaps?.paymentsById.get(item.paymentId);
    const supplierName =
      payment?.supplierName ??
      (payment?.supplierId ? paymentMaps?.suppliersById.get(payment.supplierId) : undefined);

    return {
      id: item.id,
      companyId: payment?.companyId ?? '',
      paymentId: item.paymentId,
      checkNumber: item.checkNumber,
      amount: item.amount,
      issueDate: item.issueDate,
      expectedReceiptDate: item.expectedReceiptDate ?? item.issueDate,
      status: item.status as EnrichedCheck['status'],
      agreedDepositDate: null,
      actualDepositDate: null,
      supplierName,
      currency: payment?.currency ?? 'MAD',
    };
  };

  const isOverDailyLimit = (date: string) => {
    if (!dailyLimit) return false;
    const total = issueDateTotalForLimit(entriesByIssueDate, date);
    return total > dailyLimit;
  };

  return (
    <div id="check-calendar-page" className={`check-calendar-layout ${selectedDate ? 'check-calendar-layout--drawer-open' : ''}`}>
      <div className="check-calendar-main">
        <div className="page-header">
          <div>
            <h1 className="page-header__title">Calendar</h1>
            <p className="page-header__subtitle check-calendar-month-title">{monthLabel(viewYear, viewMonth)}</p>
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
              Today, {new Date(today).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            </button>
            <button type="button" className="btn btn--ghost btn--icon" onClick={goNextMonth} aria-label="Next month">
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="check-calendar-view-tabs">
            <span className="check-calendar-view-tabs__item check-calendar-view-tabs__item--active">All</span>
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
                const entry = entriesByReceiptDate.get(cell.date);
                const isToday = cell.date === today;
                const isSelected = cell.date === selectedDate;
                const overLimit = isOverDailyLimit(cell.date);

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
                      entry && 'check-calendar-cell--has-checks',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    title={holiday?.name ?? undefined}
                    onClick={() => setSelectedDate(cell.date)}
                  >
                    <span className="check-calendar-cell__day">{Number(cell.date.slice(8, 10))}</span>
                    {holiday?.name && (
                      <span className="check-calendar-cell__holiday">{holiday.name}</span>
                    )}
                    {entry && (
                      <span className="check-calendar-cell__amount">
                        {formatMoney(entry.totalAmount, 'MAD')}
                      </span>
                    )}
                    {overLimit && (
                      <span className="check-calendar-cell__limit-warn" title="Daily payout limit exceeded on issue date">
                        <AlertTriangle size={14} />
                      </span>
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

          {selectedEntry && selectedEntry.checks.length > 0 ? (
            <div className="check-calendar-drawer__list">
              {selectedEntry.checks.map((item) => {
                const enriched = enrichCalendarCheck(item);
                return (
                  <button
                    key={item.id}
                    type="button"
                    className="check-calendar-drawer__item"
                    onClick={() => setSelectedCheck(enriched)}
                  >
                    <div className="check-calendar-drawer__item-top">
                      <span>{item.checkNumber ?? 'Pending'}</span>
                      <CheckStatusBadge status={item.status} />
                    </div>
                    <div className="check-calendar-drawer__item-amount">
                      {formatMoney(item.amount, enriched.currency)}
                    </div>
                    <div className="check-calendar-drawer__item-meta">
                      Issue: {formatDateDisplay(item.issueDate)}
                      {enriched.supplierName ? ` · ${enriched.supplierName}` : ''}
                    </div>
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
