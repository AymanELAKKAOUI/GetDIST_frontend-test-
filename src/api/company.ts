import type { Payment } from '../types/payment';
import { apiClient } from './client';

const cache = new Map<string, string | null>();

export async function fetchCompanyDisplayName(
  companyId: string,
  payments: Payment[] = [],
): Promise<string | null> {
  if (cache.has(companyId)) {
    return cache.get(companyId)!;
  }

  const fromPayments = payments.find((payment) => payment.companyName)?.companyName ?? null;
  if (fromPayments) {
    cache.set(companyId, fromPayments);
    return fromPayments;
  }

  try {
    const { data } = await apiClient.get<{ company?: { name?: string } }>('/api/companies/current');
    const name = data.company?.name?.trim() || null;
    cache.set(companyId, name);
    return name;
  } catch {
    cache.set(companyId, null);
    return null;
  }
}
