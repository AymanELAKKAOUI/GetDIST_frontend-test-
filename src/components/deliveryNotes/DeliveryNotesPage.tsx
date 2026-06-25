import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Eye, Info, Plus, RefreshCw } from 'lucide-react';
import { apiClient } from '../../api/client';
import { downloadDeliveryNotePdf } from '../../api/deliveryNotes';
import { useAuth } from '../../context/AuthContext';
import type { Supplier } from '../../types/supplier';
import type { PurchaseOrder } from '../../types/purchaseOrder';
import {
  fetchAllDeliveryNotes,
  formatDateDisplay,
  formatDateTimeDisplay,
  type DeliveryNote,
} from '../../types/deliveryNote';
import { useToast } from '../ui/Toast';
import { DeliveryNoteDetailModal } from './DeliveryNoteDetailModal';
import { DeliveryNoteStatusBadge } from './DeliveryNoteStatusBadge';
import { UploadDeliveryNoteModal } from './UploadDeliveryNoteModal';
import './DeliveryNotes.css';

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

export function DeliveryNotesPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { hasPermission, isSupplierPortalUser } = useAuth();

  const canView = hasPermission('delivery_note.view');
  const canSubmit = isSupplierPortalUser && hasPermission('delivery_note.submit');
  const canRespond = hasPermission('delivery_note.respond') && !isSupplierPortalUser;

  const [loading, setLoading] = useState(true);
  const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNote[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [supplierFilter, setSupplierFilter] = useState('');
  const [detailNote, setDetailNote] = useState<DeliveryNote | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  const suppliersById = useMemo(
    () => new Map(suppliers.map((s) => [s.id, s.name])),
    [suppliers],
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
        fetchAllDeliveryNotes(async (offset, limit) => {
          const { data } = await apiClient.get<{ deliveryNotes: DeliveryNote[] }>(
            '/api/delivery-notes',
            { params: { limit, offset } },
          );
          return data.deliveryNotes;
        }).then(setDeliveryNotes),
        apiClient
          .get<{ purchaseOrders: PurchaseOrder[] }>('/api/purchase-orders', {
            params: { limit: 100, offset: 0 },
          })
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
      showToast('Failed to load delivery notes.', 'error');
    } finally {
      setLoading(false);
    }
  }, [canView, isSupplierPortalUser, showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredNotes = useMemo(() => {
    if (!supplierFilter) return deliveryNotes;
    return deliveryNotes.filter((note) => note.supplierId === supplierFilter);
  }, [deliveryNotes, supplierFilter]);

  const resolveSupplierName = (supplierId: string) =>
    suppliersById.get(supplierId) ?? supplierId.slice(0, 8) + '…';

  const handleDownload = async (note: DeliveryNote, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!note.originalFilename) {
      showToast('No PDF file available.', 'error');
      return;
    }
    try {
      await downloadDeliveryNotePdf(note.id, note.originalFilename);
    } catch {
      showToast('Failed to download PDF.', 'error');
    }
  };

  const handleRowClick = (note: DeliveryNote) => {
    if (isSupplierPortalUser) {
      if (note.status === 'verified' || note.status === 'disputed') {
        setDetailNote(note);
      }
      return;
    }

    if (note.status === 'received' && canRespond) {
      navigate(`/delivery-notes/${note.id}`);
    } else {
      setDetailNote(note);
    }
  };

  if (isSupplierPortalUser) {
    return (
      <div id="delivery-notes-page">
        <div className="page-header">
          <div>
            <h1 className="page-header__title">Delivery Notes</h1>
            <p className="page-header__subtitle">
              Track delivery note PDFs sent against your purchase orders.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {canSubmit && (
              <button
                type="button"
                className="btn btn--sm"
                id="supplier-send-bl"
                onClick={() => setUploadOpen(true)}
              >
                <Plus size={16} />
                Send Delivery Note
              </button>
            )}
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => fetchData()} disabled={loading}>
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <TableSkeleton />
        ) : (
          <div className="table-card">
            <table className="data-table" id="supplier-delivery-notes-table">
              <thead>
                <tr>
                  <th>Date Sent</th>
                  <th>File Name</th>
                  <th>PO Reference</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredNotes.map((note) => (
                  <tr
                    key={note.id}
                    id={`dn-row-${note.id}`}
                    className={note.status === 'verified' ? 'dn-row-clickable' : undefined}
                    onClick={() => handleRowClick(note)}
                  >
                    <td>{formatDateTimeDisplay(note.createdAt ?? note.deliveryDate)}</td>
                    <td>{note.originalFilename ?? '—'}</td>
                    <td>
                      {note.purchaseOrderId
                        ? poById.get(note.purchaseOrderId) ?? note.purchaseOrderId.slice(0, 8) + '…'
                        : '—'}
                    </td>
                    <td>
                      <DeliveryNoteStatusBadge status={note.status} />
                    </td>
                    <td style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        onClick={(e) => handleDownload(note, e)}
                      >
                        <Download size={14} />
                        Download
                      </button>
                      {note.status === 'verified' && (
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDetailNote(note);
                          }}
                        >
                          <Eye size={14} />
                          Details
                        </button>
                      )}
                      {note.status === 'disputed' && note.declineReason && (
                        <RejectionInfo reason={note.declineReason} />
                      )}
                    </td>
                  </tr>
                ))}
                {filteredNotes.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--text-secondary)' }}>
                      No delivery notes yet. Send a BL from an accepted purchase order.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <DeliveryNoteDetailModal
          isOpen={!!detailNote}
          note={detailNote}
          supplierName="—"
          purchaseOrderNumber={
            detailNote?.purchaseOrderId ? poById.get(detailNote.purchaseOrderId) ?? null : null
          }
          onClose={() => setDetailNote(null)}
        />

        <UploadDeliveryNoteModal
          isOpen={uploadOpen}
          onClose={() => setUploadOpen(false)}
          onSuccess={() => {
            setUploadOpen(false);
            fetchData();
          }}
        />
      </div>
    );
  }

  return (
    <div id="delivery-notes-page">
      <div className="page-header">
        <div>
          <h1 className="page-header__title">Delivery Notes</h1>
          <p className="page-header__subtitle">
            Review received delivery notes, verify details, or view accepted records.
          </p>
        </div>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => fetchData()} disabled={loading}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      <div className="page-toolbar">
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
        <span className="page-toolbar__count">
          {filteredNotes.length} delivery note{filteredNotes.length !== 1 ? 's' : ''}
        </span>
      </div>

      {loading ? (
        <TableSkeleton />
      ) : (
        <div className="table-card">
          <table className="data-table" id="delivery-notes-table">
            <thead>
              <tr>
                <th>Date Received</th>
                <th>Supplier</th>
                <th>BL Number</th>
                <th>Delivery Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredNotes.map((note) => (
                <tr
                  key={note.id}
                  className="dn-row-clickable"
                  onClick={() => handleRowClick(note)}
                >
                  <td>{formatDateTimeDisplay(note.createdAt ?? note.deliveryDate)}</td>
                  <td>{resolveSupplierName(note.supplierId)}</td>
                  <td>{note.status === 'received' ? 'Pending' : (note.deliveryNoteNumber ?? '—')}</td>
                  <td>{note.status === 'received' ? '—' : formatDateDisplay(note.deliveryDate)}</td>
                  <td>
                    <DeliveryNoteStatusBadge status={note.status} />
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={(e) => handleDownload(note, e)}
                    >
                      <Download size={14} />
                      PDF
                    </button>
                  </td>
                </tr>
              ))}
              {filteredNotes.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-secondary)' }}>
                    No delivery notes yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <DeliveryNoteDetailModal
        isOpen={!!detailNote}
        note={detailNote}
        supplierName={detailNote ? resolveSupplierName(detailNote.supplierId) : '—'}
        purchaseOrderNumber={
          detailNote?.purchaseOrderId ? poById.get(detailNote.purchaseOrderId) ?? null : null
        }
        onClose={() => setDetailNote(null)}
      />
    </div>
  );
}
