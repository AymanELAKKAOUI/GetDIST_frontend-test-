import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, RefreshCw } from 'lucide-react';
import { apiClient } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import type { Supplier } from '../../types/supplier';
import {
  formatCurrencyAmount,
  formatDateDisplay,
  normalizePurchaseOrder,
  type PurchaseOrder,
} from '../../types/purchaseOrder';
import { useToast } from '../ui/Toast';
import { CreatePurchaseOrderModal } from './CreatePurchaseOrderModal';
import { PurchaseOrderStatusBadge } from './PurchaseOrderStatusBadge';
import './PurchaseOrders.css';

function TableSkeleton() {
  return (
    <div className="table-card" style={{ padding: '16px 0' }}>
      {[1, 2, 3].map((i) => (
        <div key={i} className="skeleton skeleton-row" style={{ height: 48, margin: '8px 16px' }} />
      ))}
    </div>
  );
}

export function PurchaseOrdersPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { hasPermission, isSupplierPortalUser } = useAuth();

  const canManage = hasPermission('purchase_order.manage') && !isSupplierPortalUser;
  const canView = hasPermission('purchase_order.view');

  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const suppliersById = useMemo(
    () => new Map(suppliers.map((s) => [s.id, s.name])),
    [suppliers],
  );

  const fetchData = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    try {
      const params: Record<string, string | number> = { limit: 100, offset: 0 };
      if (statusFilter) params.status = statusFilter;

      const tasks = [
        apiClient
          .get<{ purchaseOrders: PurchaseOrder[] }>('/api/purchase-orders', { params })
          .then(({ data }) => setOrders(data.purchaseOrders.map(normalizePurchaseOrder))),
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
      showToast('Failed to load purchase orders.', 'error');
    } finally {
      setLoading(false);
    }
  }, [canView, isSupplierPortalUser, statusFilter, showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div id="purchase-orders-page">
      <div className="page-header">
        <div>
          <h1 className="page-header__title">Purchase Orders</h1>
          <p className="page-header__subtitle">
            {isSupplierPortalUser
              ? 'View and respond to purchase orders from your client.'
              : 'Create and manage purchase orders sent to suppliers.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => fetchData()}
            disabled={loading}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
          {canManage && (
            <button type="button" className="btn btn--sm" onClick={() => setCreateOpen(true)}>
              <Plus size={16} />
              New purchase order
            </button>
          )}
        </div>
      </div>

      <div className="page-toolbar">
        <select
          className="form-select po-status-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="submitted">Submitted</option>
          <option value="approved">Approved</option>
          <option value="sent">Sent</option>
          <option value="accepted">Accepted</option>
          <option value="declined">Declined</option>
          <option value="partially_delivered">Partially Delivered</option>
          <option value="fully_delivered">Fully Delivered</option>
        </select>
        <span className="page-toolbar__count">
          {orders.length} order{orders.length !== 1 ? 's' : ''}
        </span>
      </div>

      {loading ? (
        <TableSkeleton />
      ) : (
        <div className="table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>PO Number</th>
                {!isSupplierPortalUser && <th>Supplier</th>}
                <th>Order Date</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((po) => (
                <tr
                  key={po.id}
                  className="po-row-clickable"
                  onClick={() => navigate(`/purchase-orders/${po.id}`)}
                >
                  <td>{po.purchaseOrderNumber}</td>
                  {!isSupplierPortalUser && (
                    <td>{suppliersById.get(po.supplierId) ?? po.supplierId.slice(0, 8) + '…'}</td>
                  )}
                  <td>{formatDateDisplay(po.orderDate)}</td>
                  <td>{formatCurrencyAmount(po.totalAmount, po.currency)}</td>
                  <td>
                    <PurchaseOrderStatusBadge
                      status={po.status}
                      title={po.declineReason ?? undefined}
                      strikethrough={po.status === 'cancelled'}
                    />
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={isSupplierPortalUser ? 4 : 5} style={{ textAlign: 'center', padding: 32, color: 'var(--text-secondary)' }}>
                    No purchase orders found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <CreatePurchaseOrderModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={(id) => {
          fetchData();
          navigate(`/purchase-orders/${id}`);
        }}
      />
    </div>
  );
}
