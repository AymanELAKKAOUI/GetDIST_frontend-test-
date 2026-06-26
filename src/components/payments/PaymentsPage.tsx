import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, Plus, RefreshCw, Save, X } from 'lucide-react';
import { fetchCompanyDisplayName } from '../../api/company';
import { apiClient, getApiErrorMessage } from '../../api/client';
import { mapPaymentRow } from '../../api/payments';
import { fetchActivePolicy, policyToUpdatePayload, updateCompanyPolicy } from '../../api/policies';
import { useAuth } from '../../context/AuthContext';
import type { Invoice } from '../../types/invoice';
import type { CompanyPolicy } from '../../types/policy';
import type { Supplier } from '../../types/supplier';
import {
  fetchAllPayments,
  formatDateDisplay,
  formatMoney,
  type Payment,
} from '../../types/payment';
import { useToast } from '../ui/Toast';
import { PaymentMethodBadge, PaymentStatusBadge } from './PaymentStatusBadge';
import './Payments.css';
import '../deliveryNotes/DeliveryNotes.css';
import '../invoices/Invoices.css';

function TableSkeleton() {
  return (
    <div className="table-card" style={{ padding: '16px 0' }}>
      {[1, 2, 3].map((i) => (
        <div key={i} className="skeleton skeleton-row" style={{ height: 48, margin: '8px 16px' }} />
      ))}
    </div>
  );
}

function DailyLimitPanel({
  policy,
  canManage,
  onUpdated,
}: {
  policy: CompanyPolicy | null;
  canManage: boolean;
  onUpdated: (policy: CompanyPolicy) => void;
}) {
  const { showToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draftLimit, setDraftLimit] = useState('');

  const openEdit = () => {
    if (!policy) return;
    setDraftLimit(String(policy.dailyMaximumPayoutAmount));
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraftLimit('');
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!policy) return;

    const nextLimit = Number(draftLimit);
    if (!Number.isFinite(nextLimit) || nextLimit <= 0) {
      showToast('Daily limit must be a positive amount.', 'error');
      return;
    }

    setSaving(true);
    try {
      const updated = await updateCompanyPolicy({
        ...policyToUpdatePayload(policy),
        dailyMaximumPayoutAmount: nextLimit,
      });
      onUpdated(updated);
      setEditing(false);
      showToast('Daily payout limit updated.');
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Failed to update daily limit.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pay-policy-panel">
      <div className="pay-policy-panel__header">
        <div>
          <div className="pay-policy-panel__label">Daily Payout Limit</div>
          <div className="pay-policy-panel__hint">Maximum total payouts allowed per working day.</div>
        </div>
        {canManage && policy && !editing && (
          <button type="button" className="btn btn--ghost btn--sm" onClick={openEdit}>
            <Pencil size={14} />
            Change
          </button>
        )}
      </div>

      {!policy ? (
        <p className="pay-policy-panel__empty">No active payment policy configured yet.</p>
      ) : editing ? (
        <form className="pay-policy-panel__edit" onSubmit={handleSave}>
          <input
            type="number"
            className="form-input pay-policy-panel__input"
            min={0.01}
            step="any"
            value={draftLimit}
            onChange={(e) => setDraftLimit(e.target.value)}
            autoFocus
          />
          <span className="pay-policy-panel__currency">MAD</span>
          <button type="submit" className="btn btn--sm" disabled={saving}>
            <Save size={14} />
            Save
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={cancelEdit} disabled={saving}>
            <X size={14} />
            Cancel
          </button>
        </form>
      ) : (
        <div className="pay-policy-panel__value">{formatMoney(policy.dailyMaximumPayoutAmount, 'MAD')}</div>
      )}
    </div>
  );
}

function PaymentsTable({
  payments,
  counterpartyHeader,
  resolveCounterparty,
  resolveInvoiceLabel,
  onRowClick,
}: {
  payments: Payment[];
  counterpartyHeader: string;
  resolveCounterparty: (payment: Payment) => string;
  resolveInvoiceLabel: (payment: Payment) => string;
  onRowClick: (payment: Payment) => void;
}) {
  return (
    <div className="table-card">
      <table className="data-table" id="payments-table">
        <thead>
          <tr>
            <th>{counterpartyHeader}</th>
            <th>Amount</th>
            <th>Invoice</th>
            <th>Due Date</th>
            <th>Method</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((payment) => (
            <tr
              key={payment.id}
              className="dn-row-clickable"
              onClick={() => onRowClick(payment)}
            >
              <td>{resolveCounterparty(payment)}</td>
              <td>{formatMoney(payment.amount, payment.currency)}</td>
              <td>{resolveInvoiceLabel(payment)}</td>
              <td>{formatDateDisplay(payment.dueDate)}</td>
              <td>
                <PaymentMethodBadge method={payment.paymentMethod} />
              </td>
              <td>
                <PaymentStatusBadge status={payment.status} />
              </td>
            </tr>
          ))}
          {payments.length === 0 && (
            <tr>
              <td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-secondary)' }}>
                No payments yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function PaymentsPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user, hasPermission, isSupplierPortalUser } = useAuth();

  const canView = hasPermission('payment.view');
  const canCreate = !isSupplierPortalUser && hasPermission('payment.create');
  const canManagePolicy = !isSupplierPortalUser && hasPermission('policy.manage');

  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [companyDisplayName, setCompanyDisplayName] = useState<string | null>(null);
  const [activePolicy, setActivePolicy] = useState<CompanyPolicy | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  const suppliersById = useMemo(
    () => new Map(suppliers.map((s) => [s.id, s.name])),
    [suppliers],
  );

  const invoicesById = useMemo(
    () => new Map(invoices.map((invoice) => [invoice.id, invoice])),
    [invoices],
  );

  const fetchData = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    try {
      const list = await fetchAllPayments(async (offset, limit) => {
        const { data } = await apiClient.get<{ payments: Record<string, unknown>[] }>('/api/payments', {
          params: {
            limit,
            offset,
            ...(statusFilter ? { status: statusFilter } : {}),
          },
        });
        return data.payments.map(mapPaymentRow);
      });
      setPayments(list);

      const refs: Promise<void>[] = [];

      if (isSupplierPortalUser && user?.companyId) {
        refs.push(
          fetchCompanyDisplayName(user.companyId, list).then((name) => setCompanyDisplayName(name)),
        );
      }

      if (!isSupplierPortalUser) {
        refs.push(
          apiClient.get<{ suppliers: Supplier[] }>('/api/suppliers').then(({ data }) => setSuppliers(data.suppliers)),
        );
        if (canManagePolicy) {
          refs.push(fetchActivePolicy().then((policy) => setActivePolicy(policy)));
        }
      }

      if (hasPermission('invoice.view')) {
        refs.push(
          apiClient
            .get<{ invoices: Invoice[] }>('/api/invoices', { params: { limit: 100, offset: 0 } })
            .then(({ data }) => setInvoices(data.invoices)),
        );
      }

      await Promise.all(refs);
    } catch {
      showToast('Failed to load payments.', 'error');
    } finally {
      setLoading(false);
    }
  }, [canView, canManagePolicy, isSupplierPortalUser, showToast, statusFilter, hasPermission, user?.companyId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const resolveSupplierName = (payment: Payment) =>
    payment.supplierName ?? suppliersById.get(payment.supplierId) ?? payment.supplierId.slice(0, 8) + '…';

  const resolveCompanyName = (payment: Payment) =>
    payment.companyName ?? companyDisplayName ?? '—';

  const resolveInvoiceLabel = (payment: Payment) => {
    if (!payment.invoiceId) return '—';
    const invoice = invoicesById.get(payment.invoiceId);
    return invoice?.invoiceNumber ?? invoice?.originalFilename ?? payment.invoiceId.slice(0, 8) + '…';
  };

  const toolbar = (
    <div className="page-toolbar">
      <select
        className="form-select po-status-filter"
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value)}
      >
        <option value="">All statuses</option>
        <option value="draft">Draft</option>
        <option value="pending_validation">Awaiting Approval</option>
        <option value="scheduled">Scheduled</option>
        <option value="paid">Paid</option>
        <option value="cancelled">Cancelled</option>
      </select>
      <span className="page-toolbar__count">
        {payments.length} payment{payments.length !== 1 ? 's' : ''}
      </span>
    </div>
  );

  if (isSupplierPortalUser) {
    return (
      <div id="payments-page">
        <div className="page-header">
          <div>
            <h1 className="page-header__title">Payments</h1>
            <p className="page-header__subtitle">Track payments from your client company.</p>
          </div>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => fetchData()} disabled={loading}>
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        {toolbar}

        {loading ? (
          <TableSkeleton />
        ) : (
          <PaymentsTable
            payments={payments}
            counterpartyHeader="Company"
            resolveCounterparty={resolveCompanyName}
            resolveInvoiceLabel={resolveInvoiceLabel}
            onRowClick={(payment) => navigate(`/payments/${payment.id}`)}
          />
        )}
      </div>
    );
  }

  return (
    <div id="payments-page">
      <div className="page-header">
        <div>
          <h1 className="page-header__title">Payments</h1>
          <p className="page-header__subtitle">Manage payment drafts, approvals, scheduling, and settlement.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {canCreate && (
            <button type="button" className="btn btn--sm" onClick={() => navigate('/payments/new')}>
              <Plus size={16} />
              New Payment
            </button>
          )}
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => fetchData()} disabled={loading}>
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      {canManagePolicy && !loading && (
        <DailyLimitPanel
          policy={activePolicy}
          canManage={canManagePolicy}
          onUpdated={setActivePolicy}
        />
      )}

      {toolbar}

      {loading ? (
        <TableSkeleton />
      ) : (
        <PaymentsTable
          payments={payments}
          counterpartyHeader="Supplier"
          resolveCounterparty={resolveSupplierName}
          resolveInvoiceLabel={resolveInvoiceLabel}
          onRowClick={(payment) => navigate(`/payments/${payment.id}`)}
        />
      )}
    </div>
  );
}
