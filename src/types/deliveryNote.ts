export type DeliveryNoteStatus = 'received' | 'verified' | 'disputed';

export interface DeliveryNoteSection {
  titre: string;
  description: string;
}

/** Legacy product/qty shape may still appear on older records. */
export interface DeliveryNoteLineItem {
  titre?: string;
  description?: string;
  productName?: string;
  quantity?: number;
  quantityAccepted?: number;
  quantityRejected?: number;
}

export interface DeliveryNote {
  id: string;
  companyId: string;
  supplierId: string;
  purchaseOrderId: string | null;
  deliveryNoteNumber: string | null;
  deliveryDate: string;
  status: DeliveryNoteStatus;
  lineItems: DeliveryNoteLineItem[];
  receivedByUserId: string | null;
  respondedByUserId?: string | null;
  respondedAt?: string | null;
  declineReason: string | null;
  pdfFilePath: string | null;
  originalFilename: string | null;
  createdAt?: string;
}

export function emptySection(): DeliveryNoteSection {
  return { titre: '', description: '' };
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function suggestDeliveryNoteNumber(): string {
  const year = new Date().getFullYear();
  const suffix = String(Math.floor(Math.random() * 9000) + 1000);
  return `BL-${year}-${suffix}`;
}

export function formatDateDisplay(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export function formatDateTimeDisplay(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function normalizeSections(items: DeliveryNoteLineItem[]): DeliveryNoteSection[] {
  return items.map((item) => {
    if (item.titre != null || item.description != null) {
      return { titre: item.titre ?? '', description: item.description ?? '' };
    }
    const parts = [item.productName, item.quantity != null ? `Qty: ${item.quantity}` : '']
      .filter(Boolean)
      .join(' · ');
    return { titre: item.productName ?? 'Item', description: parts };
  });
}

export function statusDisplayLabel(status: DeliveryNoteStatus): string {
  switch (status) {
    case 'received':
      return 'Pending Review';
    case 'verified':
      return 'Accepted';
    case 'disputed':
      return 'Rejected';
    default:
      return status;
  }
}

export async function fetchAllDeliveryNotes(
  fetchPage: (offset: number, limit: number) => Promise<DeliveryNote[]>,
  pageSize = 100,
): Promise<DeliveryNote[]> {
  const all: DeliveryNote[] = [];
  let offset = 0;
  for (;;) {
    const page = await fetchPage(offset, pageSize);
    all.push(...page);
    if (page.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}
