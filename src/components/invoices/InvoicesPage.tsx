import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Download, Eye, Info, RefreshCw } from 'lucide-react';
import { apiClient } from '../../api/client';
import { approveInvoice, downloadInvoicePdf } from '../../api/invoices';
import { useAuth } from '../../context/AuthContext';
import type { DeliveryNote } from '../../types/deliveryNote';
import {
  fetchAllInvoices,
  formatDateDisplay,
  formatDateTimeDisplay,
  formatMoney,
  type Invoice,
  type InvoiceStatus,
} from '../../types/invoice';
import type { PurchaseOrder } from '../../types/purchaseOrder';
import type { Supplier } from '../../types/supplier';
import { useToast } from '../ui/Toast';
import { InvoiceDetailModal } from './InvoiceDetailModal';
import { InvoiceStatusBadge } from './InvoiceStatusBadge';
import './Invoices.css';
import '../deliveryNotes/DeliveryNotes.css';

function TableSkeleton() {
  return (
    <div className="table-card" style={{ padding: '16px 0' }}>
      {[1, 2, 3].map((i) => (
        <div key={i} className="skeleton skeleton-row" style={{ height: 48, margin: '8px 16px' }} />
      ))}
    </div>
  );
}

function RejectionInfo({ reason }: { reason: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="dn-info-tooltip-wrap">
      <button
        type="button"
        className="btn--icon"
        aria-label="View rejection reason"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <Info size={16} />
      </button>
      {open && (
        <div className="dn-info-tooltip" role="tooltip">
          {reason}
        </div>
      )}
    </div>
  );
}

function daysUntilDue(dueDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  return Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function InvoicesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const { hasPermission, isSupplierPortalUser } = useAuth();

  const canView = hasPermission('invoice.view');
  const canRespond = hasPermission('invoice.respond') && !isSupplierPortalUser;

  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNote[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);

  const [supplierFilter, setSupplierFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [detailInvoice, setDetailInvoice] = useState<Invoice | null>(null);
  const [showApproveOnDetail, setShowApproveOnDetail] = useState(false);
  const [approving, setApproving] = useState(false);

  const suppliersById = useMemo(
    () => new Map(suppliers.map((s) => [s.id, s.name])),
    [suppliers],
  );

  const dnById = useMemo(
    () => new Map(deliveryNotes.map((dn) => [dn.id, dn])),
    [deliveryNotes],
  );

  const poById = useMemo(
    () => new Map(purchaseOrders.map((po) => [po.id, po.purchaseOrderNumber])),
    [purchaseOrders],
  );

  const fetchData = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    try {
      const tasks: Promise<void>[] = [
        fetchAllInvoices(async (offset, limit) => {
          const { data } = await apiClient.get<{ invoices: Invoice[] }>('/api/invoices', {
            params: { limit, offset },
          });
          return data.invoices;
        }).then(setInvoices),
        apiClient
          .get<{ deliveryNotes: DeliveryNote[] }>('/api/delivery-notes', { params: { limit: 100, offset: 0 } })
          .then(({ data }) => setDeliveryNotes(data.deliveryNotes)),
        apiClient
          .get<{ purchaseOrders: PurchaseOrder[] }>('/api/purchase-orders', { params: { limit: 100, offset: 0 } })
          .then(({ data }) => setPurchaseOrders(data.purchaseOrders)),
      ];

      if (!isSupplierPortalUser) {
        tasks.push(
          apiClient
            .get<{ suppliers: Supplier[] }>('/api/suppliers')
            .then(({ data }) => setSuppliers(data.suppliers)),
        );
      }

      await Promise.all(tasks);
    } catch {
      showToast('Failed to load invoices.', 'error');
    } finally {
      setLoading(false);
    }
  }, [canView, isSupplierPortalUser, showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const state = location.state as { openInvoiceId?: string } | null;
    if (!state?.openInvoiceId || invoices.length === 0) return;
    const target = invoices.find((inv) => inv.id === state.openInvoiceId);
    if (target) {
      setDetailInvoice(target);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [invoices, location.pathname, location.state, navigate]);

  const filteredInvoices = useMemo(() => {
    let list = invoices;
    if (supplierFilter) {
      list = list.filter((inv) => inv.supplierId === supplierFilter);
    }
    if (statusFilter) {
      list = list.filter((inv) => inv.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (inv) =>
          (inv.invoiceNumber?.toLowerCase().includes(q) ?? false) ||
          (inv.originalFilename?.toLowerCase().includes(q) ?? false),
      );
    }
    return list;
  }, [invoices, supplierFilter, statusFilter, searchQuery]);

  const agingSummary = useMemo(() => {
    const buckets = {
      current: 0,
      days1to15: 0,
      days16to30: 0,
      days31to60: 0,
      over60: 0,
    };
    let total = 0;

    for (const inv of filteredInvoices) {
      if (!['approved', 'partially_paid'].includes(inv.status) || inv.totalAmount == null) continue;
      total += inv.totalAmount;
      const days = daysUntilDue(inv.dueDate);
      if (days > 60) buckets.over60 += inv.totalAmount;
      else if (days > 30) buckets.days31to60 += inv.totalAmount;
      else if (days > 15) buckets.days16to30 += inv.totalAmount;
      else if (days > 0) buckets.days1to15 += inv.totalAmount;
      else buckets.current += inv.totalAmount;
    }

    return { total, buckets };
  }, [filteredInvoices]);

  const resolveSupplierName = (supplierId: string) =>
    suppliersById.get(supplierId) ?? supplierId.slice(0, 8) + '…';

  const resolveBlRef = (deliveryNoteId: string | null) => {
    if (!deliveryNoteId) return '—';
    const dn = dnById.get(deliveryNoteId);
    return dn?.deliveryNoteNumber ?? dn?.originalFilename ?? deliveryNoteId.slice(0, 8) + '…';
  };

  const resolvePoRef = (purchaseOrderId: string | null) => {
    if (!purchaseOrderId) return '—';
    return poById.get(purchaseOrderId) ?? purchaseOrderId.slice(0, 8) + '…';
  };

  const handleDownload = async (invoice: Invoice, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!invoice.originalFilename) {
      showToast('No PDF file available.', 'error');
      return;
    }
    try {
      await downloadInvoicePdf(invoice.id, invoice.originalFilename);
    } catch {
      showToast('Failed to download PDF.', 'error');
    }
  };

  const openDetail = (invoice: Invoice, withApprove = false) => {
    setDetailInvoice(invoice);
    setShowApproveOnDetail(withApprove);
  };

  const handleRowClick = (invoice: Invoice) => {
    if (isSupplierPortalUser) {
      openDetail(invoice);
      return;
    }

    if (invoice.status === 'received' && canRespond) {
      navigate(`/invoices/${invoice.id}`);
    } else if (invoice.status === 'pending_verification' && canRespond) {
      openDetail(invoice, true);
    } else {
      openDetail(invoice);
    }
  };

  const handleApprove = async () => {
    if (!detailInvoice) return;
    setApproving(true);
    try {
      await approveInvoice(detailInvoice.id);
      showToast('Invoice approved.');
      setDetailInvoice(null);
      setShowApproveOnDetail(false);
      fetchData();
    } catch {
      showToast('Failed to approve invoice.', 'error');
    } finally {
      setApproving(false);
    }
  };

  const dateSent = (invoice: Invoice) =>
    formatDateTimeDisplay(invoice.createdAt ?? invoice.invoiceDate);

  if (isSupplierPortalUser) {
    return (
      <div id="invoices-page">
        <div className="page-header">
          <div>
            <h1 className="page-header__title">Invoices</h1>
            <p className="page-header__subtitle">Track invoice PDFs sent against verified delivery notes.</p>
          </div>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => fetchData()} disabled={loading}>
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        {loading ? (
          <TableSkeleton />
        ) : (
          <div className="table-card">
            <table className="data-table" id="supplier-invoices-table">
              <thead>
                <tr>
                  <th>Date Sent</th>
                  <th>File Name</th>
                  <th>BL Ref</th>
                  <th>PO Ref</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((invoice) => (
                  <tr
                    key={invoice.id}
                    id={`inv-row-${invoice.id}`}
                    className="dn-row-clickable"
                    onClick={() => handleRowClick(invoice)}
                  >
                    <td>{dateSent(invoice)}</td>
                    <td>{invoice.originalFilename ?? '—'}</td>
                    <td>{resolveBlRef(invoice.deliveryNoteId)}</td>
                    <td>{resolvePoRef(invoice.purchaseOrderId)}</td>
                    <td>
                      <InvoiceStatusBadge status={invoice.status} />
                    </td>
                    <td style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        onClick={(e) => handleDownload(invoice, e)}
                      >
                        <Download size={14} />
                        Download
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDetail(invoice);
                        }}
                      >
                        <Eye size={14} />
                        Details
                      </button>
                      {invoice.status === 'disputed' && invoice.declineReason && (
                        <RejectionInfo reason={invoice.declineReason} />
                      )}
                    </td>
                  </tr>
                ))}
                {filteredInvoices.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-secondary)' }}>
                      No invoices yet. Send an invoice from a verified delivery note.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <InvoiceDetailModal
          isOpen={!!detailInvoice}
          invoice={detailInvoice}
          deliveryNoteNumber={
            detailInvoice?.deliveryNoteId ? resolveBlRef(detailInvoice.deliveryNoteId) : null
          }
          purchaseOrderNumber={
            detailInvoice?.purchaseOrderId ? resolvePoRef(detailInvoice.purchaseOrderId) : null
          }
          onClose={() => setDetailInvoice(null)}
        />
      </div>
    );
  }

  return (
    <div id="invoices-page">
      <div className="page-header">
        <div>
          <h1 className="page-header__title">Received Invoices</h1>
          <p className="page-header__subtitle">Review, verify, and manage supplier invoices.</p>
        </div>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => fetchData()} disabled={loading}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {!loading && filteredInvoices.length > 0 && (
        <div className="inv-summary">
          <div>
            <div className="inv-summary__total-label">Total Invoiced</div>
            <div className="inv-summary__total-value">{formatMoney(agingSummary.total)}</div>
          </div>
          <div className="inv-summary__aging">
            {agingSummary.buckets.current > 0 && (
              <div className="inv-aging-chip inv-aging-chip--green">
                <div className="inv-aging-chip__amount">{formatMoney(agingSummary.buckets.current)}</div>
                <div className="inv-aging-chip__label">Due now</div>
              </div>
            )}
            {agingSummary.buckets.days1to15 > 0 && (
              <div className="inv-aging-chip inv-aging-chip--yellow">
                <div className="inv-aging-chip__amount">{formatMoney(agingSummary.buckets.days1to15)}</div>
                <div className="inv-aging-chip__label">1–15 days</div>
              </div>
            )}
            {agingSummary.buckets.days16to30 > 0 && (
              <div className="inv-aging-chip inv-aging-chip--blue">
                <div className="inv-aging-chip__amount">{formatMoney(agingSummary.buckets.days16to30)}</div>
                <div className="inv-aging-chip__label">16–30 days</div>
              </div>
            )}
            {agingSummary.buckets.days31to60 > 0 && (
              <div className="inv-aging-chip inv-aging-chip--orange">
                <div className="inv-aging-chip__amount">{formatMoney(agingSummary.buckets.days31to60)}</div>
                <div className="inv-aging-chip__label">31–60 days</div>
              </div>
            )}
            {agingSummary.buckets.over60 > 0 && (
              <div className="inv-aging-chip inv-aging-chip--red">
                <div className="inv-aging-chip__amount">{formatMoney(agingSummary.buckets.over60)}</div>
                <div className="inv-aging-chip__label">60+ days</div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="inv-filters-row">
        <input
          type="search"
          className="form-input inv-search-input"
          placeholder="Search by invoice number or file name…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <select
          className="form-select po-status-filter"
          value={supplierFilter}
          onChange={(e) => setSupplierFilter(e.target.value)}
        >
          <option value="">All suppliers</option>
          {suppliers.map((supplier) => (
            <option key={supplier.id} value={supplier.id}>
              {supplier.name}
            </option>
          ))}
        </select>
        <select
          className="form-select po-status-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as InvoiceStatus | '')}
        >
          <option value="">All statuses</option>
          <option value="received">Pending Review</option>
          <option value="pending_verification">Awaiting Approval</option>
          <option value="approved">Accepted</option>
          <option value="disputed">Rejected</option>
          <option value="partially_paid">Partially Paid</option>
          <option value="paid">Paid</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <span className="page-toolbar__count">
          {filteredInvoices.length} invoice{filteredInvoices.length !== 1 ? 's' : ''}
        </span>
      </div>

      {loading ? (
        <TableSkeleton />
      ) : (
        <div className="table-card">
          <table className="data-table" id="admin-invoices-table">
            <thead>
              <tr>
                <th>Invoice No.</th>
                <th>Supplier</th>
                <th>Amount</th>
                <th>Issue Date</th>
                <th>Due Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.map((invoice) => (
                <tr
                  key={invoice.id}
                  className="dn-row-clickable"
                  onClick={() => handleRowClick(invoice)}
                >
                  <td>{invoice.invoiceNumber ?? invoice.originalFilename ?? 'Pending'}</td>
                  <td>{resolveSupplierName(invoice.supplierId)}</td>
                  <td>{formatMoney(invoice.totalAmount, invoice.currency)}</td>
                  <td>{formatDateDisplay(invoice.invoiceDate)}</td>
                  <td>{formatDateDisplay(invoice.dueDate)}</td>
                  <td>
                    <InvoiceStatusBadge status={invoice.status} />
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={(e) => handleDownload(invoice, e)}
                    >
                      <Download size={14} />
                      PDF
                    </button>
                  </td>
                </tr>
              ))}
              {filteredInvoices.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text-secondary)' }}>
                    No invoices yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <InvoiceDetailModal
        isOpen={!!detailInvoice}
        invoice={detailInvoice}
        supplierName={detailInvoice ? resolveSupplierName(detailInvoice.supplierId) : undefined}
        deliveryNoteNumber={
          detailInvoice?.deliveryNoteId ? resolveBlRef(detailInvoice.deliveryNoteId) : null
        }
        purchaseOrderNumber={
          detailInvoice?.purchaseOrderId ? resolvePoRef(detailInvoice.purchaseOrderId) : null
        }
        showApprove={showApproveOnDetail}
        approving={approving}
        onApprove={handleApprove}
        onClose={() => {
          setDetailInvoice(null);
          setShowApproveOnDetail(false);
        }}
      />
    </div>
  );
}
