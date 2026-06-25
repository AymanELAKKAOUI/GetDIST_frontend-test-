import { apiClient } from './client';
import type { DeliveryNote } from '../types/deliveryNote';

export async function fetchDeliveryNotePdfBlob(deliveryNoteId: string): Promise<Blob> {
  const { data } = await apiClient.get<Blob>(`/api/delivery-notes/${deliveryNoteId}/download`, {
    responseType: 'blob',
  });
  return data;
}

export async function downloadDeliveryNotePdf(
  deliveryNoteId: string,
  filename: string,
): Promise<void> {
  const blob = await fetchDeliveryNotePdfBlob(deliveryNoteId);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function uploadDeliveryNotePdf(
  purchaseOrderId: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<{ deliveryNote: DeliveryNote }> {
  const formData = new FormData();
  formData.append('file', file);

  const { data } = await apiClient.post<{ deliveryNote: DeliveryNote }>(
    `/api/delivery-notes/upload?purchaseOrderId=${encodeURIComponent(purchaseOrderId)}`,
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
