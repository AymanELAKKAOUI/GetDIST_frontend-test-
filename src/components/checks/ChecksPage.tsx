import { useCallback, useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { CalendarDays, RefreshCw } from 'lucide-react';
import { enrichChecks, listChecks, loadPaymentAndSupplierMaps } from '../../api/checks';
import { useAuth } from '../../context/AuthContext';
import type { CheckStatus, EnrichedCheck } from '../../types/check';
import { fetchAllChecks, formatDateDisplay, formatMoney } from '../../types/check';
import { useToast } from '../ui/Toast';
import { CheckStatusBadge } from '../payments/PaymentStatusBadge';
import { CheckDetailModal } from './CheckDetailModal';
import './Checks.css';
import '../deliveryNotes/DeliveryNotes.css';
import '../payments/Payments.css';

function TableSkeleton() {
  return (
    <div className="table-card" style={{ padding: '16px 0' }}>
      {[1, 2, 3].map((i) => (
        <div key={i} className="skeleton skeleton-row" style={{ height: 48, margin: '8px 16px' }} />
      ))}
    </div>
  );
}

export function ChecksPage() {
  const { showToast } = useToast();
  const { isSupplierPortalUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [checks, setChecks] = useState<EnrichedCheck[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [issueDateFrom, setIssueDateFrom] = useState('');
  const [issueDateTo, setIssueDateTo] = useState('');
  const [receiptDateFrom, setReceiptDateFrom] = useState('');
  const [receiptDateTo, setReceiptDateTo] = useState('');
  const [selectedCheck, setSelectedCheck] = useState<EnrichedCheck | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const raw = await fetchAllChecks(async (offset, limit) =>
        listChecks({
          limit,
          offset,
          ...(statusFilter ? { status: statusFilter as CheckStatus } : {}),
          ...(issueDateFrom ? { issueDateFrom } : {}),
          ...(issueDateTo ? { issueDateTo } : {}),
          ...(receiptDateFrom ? { expectedReceiptDateFrom: receiptDateFrom } : {}),
          ...(receiptDateTo ? { expectedReceiptDateTo: receiptDateTo } : {}),
        }),
      );

      const { paymentsById, suppliersById } = await loadPaymentAndSupplierMaps(isSupplierPortalUser);
      setChecks(enrichChecks(raw, paymentsById, suppliersById));
    } catch {
      showToast('Failed to load checks.', 'error');
    } finally {
      setLoading(false);
    }
  }, [
    isSupplierPortalUser,
    issueDateFrom,
    issueDateTo,
    receiptDateFrom,
    receiptDateTo,
    showToast,
    statusFilter,
  ]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div id="checks-page">
      <div className="page-header">
        <div>
          <h1 className="page-header__title">Checks</h1>
          <p className="page-header__subtitle">
            {isSupplierPortalUser
              ? 'Track checks linked to your supplier account.'
              : 'Issue, receive, and manage check lifecycle.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <NavLink to="/checks/calendar" className="btn btn--ghost btn--sm">
            <CalendarDays size={16} />
            Calendar
          </NavLink>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => fetchData()} disabled={loading}>
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      <div className="check-filters">
        <select
          className="form-select po-status-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="planned">Planned</option>
          <option value="issued">Issued</option>
          <option value="received">Received</option>
          <option value="cleared">Cleared</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <label className="check-filter-date">
          <span>Issue from</span>
          <input type="date" className="form-input" value={issueDateFrom} onChange={(e) => setIssueDateFrom(e.target.value)} />
        </label>
        <label className="check-filter-date">
          <span>Issue to</span>
          <input type="date" className="form-input" value={issueDateTo} onChange={(e) => setIssueDateTo(e.target.value)} />
        </label>
        <label className="check-filter-date">
          <span>Receipt from</span>
          <input type="date" className="form-input" value={receiptDateFrom} onChange={(e) => setReceiptDateFrom(e.target.value)} />
        </label>
        <label className="check-filter-date">
          <span>Receipt to</span>
          <input type="date" className="form-input" value={receiptDateTo} onChange={(e) => setReceiptDateTo(e.target.value)} />
        </label>
        <span className="page-toolbar__count">
          {checks.length} check{checks.length !== 1 ? 's' : ''}
        </span>
      </div>

      {loading ? (
        <TableSkeleton />
      ) : (
        <div className="table-card">
          <table className="data-table" id="checks-table">
            <thead>
              <tr>
                <th>Issue Date</th>
                <th>Expected Receipt</th>
                <th>Check Number</th>
                <th>Amount</th>
                {!isSupplierPortalUser && <th>Supplier</th>}
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {checks.map((check) => (
                <tr
                  key={check.id}
                  className="dn-row-clickable"
                  onClick={() => setSelectedCheck(check)}
                >
                  <td>{formatDateDisplay(check.issueDate)}</td>
                  <td>{formatDateDisplay(check.expectedReceiptDate)}</td>
                  <td>{check.checkNumber ?? 'Pending'}</td>
                  <td>{formatMoney(check.amount, check.currency)}</td>
                  {!isSupplierPortalUser && <td>{check.supplierName ?? '—'}</td>}
                  <td>
                    <CheckStatusBadge status={check.status} />
                  </td>
                </tr>
              ))}
              {checks.length === 0 && (
                <tr>
                  <td colSpan={isSupplierPortalUser ? 5 : 6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-secondary)' }}>
                    No checks found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
