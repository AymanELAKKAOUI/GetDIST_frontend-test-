import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Key, Pencil, Plus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiClient, getApiErrorMessage } from '../../api/client';
import type { Supplier, SupplierStatus } from '../../types/supplier';
import {
  formatSupplierStatus,
  SUPPLIER_STATUS_FILTER_OPTIONS,
} from '../../types/supplier';
import { SearchInput } from '../ui/SearchInput';
import { useToast } from '../ui/Toast';
import { SupplierFormModal } from './SupplierFormModal';
import { ProvisionPortalUserModal } from './ProvisionPortalUserModal';
import './SuppliersPage.css';

function TableSkeleton() {
  return (
    <div className="table-card" style={{ padding: '16px 0' }}>
      {[1, 2, 3].map((i) => (
        <div key={i} className="skeleton skeleton-row" />
      ))}
    </div>
  );
}

function SupplierStatusBadge({ status }: { status: SupplierStatus }) {
  return (
    <span className={`supplier-status supplier-status--${status}`} id={`status-${status}`}>
      {formatSupplierStatus(status)}
    </span>
  );
}

export function SuppliersPage() {
  const { hasPermission } = useAuth();
  const { showToast } = useToast();
  const canManage = hasPermission('supplier.manage');

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | SupplierStatus>('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [portalTarget, setPortalTarget] = useState<Supplier | null>(null);
  const [transitioningId, setTransitioningId] = useState<string | null>(null);

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    try {
      const params = statusFilter ? { status: statusFilter } : undefined;
      const { data } = await apiClient.get<{ suppliers: Supplier[] }>('/api/suppliers', {
        params,
      });
      setSuppliers(data.suppliers);
    } catch {
      showToast('Failed to load suppliers.', 'error');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, showToast]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  const filteredSuppliers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return suppliers;

    return suppliers.filter((supplier) => {
      const haystack = [
        supplier.name,
        supplier.legalName ?? '',
        supplier.email ?? '',
        supplier.phone ?? '',
        supplier.contactName ?? '',
        supplier.city ?? '',
        supplier.status,
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [suppliers, search]);

  const handleTransition = async (
    supplier: Supplier,
    action: 'submit' | 'validate' | 'suspend' | 'reactivate',
    successMessage: string,
  ) => {
    setTransitioningId(supplier.id);
    try {
      const { data } = await apiClient.post<{ supplier: Supplier }>(
        `/api/suppliers/${supplier.id}/${action}`,
      );
      setSuppliers((prev) => prev.map((s) => (s.id === supplier.id ? data.supplier : s)));
      showToast(successMessage);
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? getApiErrorMessage(err, 'Invalid status transition.')
        : 'Invalid status transition.';
      showToast(message, 'error');
    } finally {
      setTransitioningId(null);
    }
  };

  const handleFormSuccess = async (updated?: Supplier) => {
    if (updated) {
      setSuppliers((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      showToast('Supplier updated successfully.');
    } else {
      await fetchSuppliers();
      showToast('Supplier created successfully.');
    }
  };

  const renderWorkflowActions = (supplier: Supplier) => {
    if (!canManage) return null;

    const busy = transitioningId === supplier.id;
    const btnClass = 'btn btn--ghost btn--sm';

    switch (supplier.status) {
      case 'draft':
        return (
          <button
            type="button"
            className={btnClass}
            id={`submit-supplier-${supplier.id}`}
            disabled={busy}
            onClick={() =>
              handleTransition(supplier, 'submit', 'Supplier submitted for validation.')
            }
          >
            Submit
          </button>
        );
      case 'pending_validation':
        return (
          <button
            type="button"
            className={btnClass}
            id={`validate-supplier-${supplier.id}`}
            disabled={busy}
            onClick={() => handleTransition(supplier, 'validate', 'Supplier validated and activated.')}
          >
            Validate
          </button>
        );
      case 'active':
        return (
          <button
            type="button"
            className={btnClass}
            id={`suspend-supplier-${supplier.id}`}
            disabled={busy}
            onClick={() => handleTransition(supplier, 'suspend', 'Supplier suspended.')}
          >
            Suspend
          </button>
        );
      case 'suspended':
      case 'inactive':
        return (
          <button
            type="button"
            className={btnClass}
            id={`reactivate-supplier-${supplier.id}`}
            disabled={busy}
            onClick={() => handleTransition(supplier, 'reactivate', 'Supplier reactivated.')}
          >
            Reactivate
          </button>
        );
      default:
        return null;
    }
  };

  return (
    <div id="suppliers-page">
      <div className="page-header">
        <div>
          <h1 className="page-header__title" id="suppliers-title">
            Suppliers
          </h1>
          <p className="page-header__subtitle">
            Maintain vendor profiles, payment configurations, and provision portal accounts.
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            className="btn"
            id="create-supplier-btn"
            onClick={() => {
              setEditingSupplier(null);
              setFormOpen(true);
            }}
          >
            <Plus size={16} />
            Create Supplier
          </button>
        )}
      </div>

      {!loading && (
        <div className="page-toolbar suppliers-toolbar">
          <div className="suppliers-toolbar__filters">
            <SearchInput
              id="suppliers-search"
              value={search}
              onChange={setSearch}
              placeholder="Search suppliers…"
            />
            <select
              id="suppliers-status-filter"
              className="form-select suppliers-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as '' | SupplierStatus)}
            >
              {SUPPLIER_STATUS_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value || 'all'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <span className="page-toolbar__count" id="suppliers-count">
            {filteredSuppliers.length} of {suppliers.length} suppliers
          </span>
        </div>
      )}

      {loading ? (
        <TableSkeleton />
      ) : (
        <div className="table-card">
          <table className="data-table" id="suppliers-table">
            <thead>
              <tr>
                <th>Supplier Name</th>
                <th>Contact Info</th>
                <th>Status</th>
                <th>Strategic</th>
                <th style={{ minWidth: 200 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSuppliers.map((supplier) => (
                <tr key={supplier.id} id={`supplier-row-${supplier.id}`}>
                  <td>
                    <div className="supplier-name-cell">
                      <span className="supplier-name">{supplier.name}</span>
                      {supplier.legalName && (
                        <span className="supplier-legal-name">{supplier.legalName}</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="supplier-contact-cell">
                      {supplier.contactName && (
                        <span className="supplier-contact-name">{supplier.contactName}</span>
                      )}
                      {supplier.email && (
                        <span className="supplier-contact-detail">{supplier.email}</span>
                      )}
                      {supplier.phone && (
                        <span className="supplier-contact-detail">{supplier.phone}</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <SupplierStatusBadge status={supplier.status} />
                  </td>
                  <td>
                    <div className="supplier-meta-pills">
                      {supplier.isStrategic && (
                        <span className="supplier-meta-pill supplier-meta-pill--strategic">
                          Strategic
                        </span>
                      )}
                      <span
                        className={`supplier-meta-pill ${
                          supplier.hasAlternative
                            ? 'supplier-meta-pill--alt'
                            : 'supplier-meta-pill--sole'
                        }`}
                      >
                        {supplier.hasAlternative ? 'Alternative Available' : 'Sole Source'}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="supplier-actions">
                      {canManage && (
                        <>
                          <button
                            type="button"
                            className="btn--icon"
                            id={`edit-supplier-${supplier.id}`}
                            onClick={() => {
                              setEditingSupplier(supplier);
                              setFormOpen(true);
                            }}
                            aria-label={`Edit ${supplier.name}`}
                          >
                            <Pencil size={16} />
                          </button>
                          {renderWorkflowActions(supplier)}
                          {supplier.status === 'active' && (
                            <button
                              type="button"
                              className="btn--icon"
                              id={`provision-portal-${supplier.id}`}
                              onClick={() => setPortalTarget(supplier)}
                              aria-label={`Provision portal user for ${supplier.name}`}
                              title="Provision Portal User"
                            >
                              <Key size={16} />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredSuppliers.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 32 }}
                  >
                    {suppliers.length === 0 ? 'No suppliers found.' : 'No suppliers match your search.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <SupplierFormModal
        isOpen={formOpen}
        supplier={editingSupplier}
        onClose={() => setFormOpen(false)}
        onSuccess={handleFormSuccess}
      />

      <ProvisionPortalUserModal
        isOpen={!!portalTarget}
        supplierId={portalTarget?.id ?? null}
        supplierName={portalTarget?.name ?? ''}
        onClose={() => setPortalTarget(null)}
        onSuccess={() => showToast('Portal user created successfully.')}
      />
    </div>
  );
}
