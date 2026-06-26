import { apiClient } from './client';
import type { Invoice } from '../types/invoice';

export async function fetchInvoicePdfBlob(invoiceId: string): Promise<Blob> {
  const { data } = await apiClient.get<Blob>(`/api/invoices/${invoiceId}/download`, {
    responseType: 'blob',
  });
  return data;
}

export async function downloadInvoicePdf(invoiceId: string, filename: string): Promise<void> {
  const blob = await fetchInvoicePdfBlob(invoiceId);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function uploadInvoicePdf(
  deliveryNoteId: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<{ invoice: Invoice }> {
  const formData = new FormData();
  formData.append('file', file);

  const { data } = await apiClient.post<{ invoice: Invoice }>(
    `/api/invoices/upload?deliveryNoteId=${encodeURIComponent(deliveryNoteId)}`,
    formData,
    {
      timeout: 120_000,
      onUploadProgress: (event) => {
        if (event.total && onProgress) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      },
    },
  );

  return data;
}

export async function approveInvoice(invoiceId: string): Promise<{ invoice: Invoice }> {
  const { data } = await apiClient.post<{ invoice: Invoice }>(`/api/invoices/${invoiceId}/approve`);
  return data;
}
