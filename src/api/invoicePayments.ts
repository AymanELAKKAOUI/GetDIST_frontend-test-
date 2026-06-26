import type { Invoice } from '../types/invoice';
import type { Payment, PaymentStatus } from '../types/payment';

export interface CreatePaymentFromInvoicePrefill {
  invoiceId: string;
  supplierId: string;
  amount: number;
  currency: string;
  dueDate: string;
  invoiceNumber?: string | null;
  description?: string;
}

export function isInvoicePayable(invoice: Invoice): boolean {
  return invoice.status === 'approved' || invoice.status === 'partially_paid';
}

export function buildPaymentPrefillFromInvoice(invoice: Invoice): CreatePaymentFromInvoicePrefill {
  const label = invoice.invoiceNumber ?? invoice.originalFilename ?? invoice.id.slice(0, 8);
  return {
    invoiceId: invoice.id,
    supplierId: invoice.supplierId,
    amount: invoice.totalAmount ?? 0,
    currency: invoice.currency,
    dueDate: invoice.dueDate,
    invoiceNumber: invoice.invoiceNumber,
    description: `Payment for invoice ${label}`,
  };
}

const ACTIVE_PAYMENT_STATUSES: PaymentStatus[] = ['draft', 'pending_validation', 'scheduled'];

export function findActivePaymentForInvoice(
  invoiceId: string,
  payments: Payment[],
): Payment | undefined {
  return payments.find(
    (payment) => payment.invoiceId === invoiceId && ACTIVE_PAYMENT_STATUSES.includes(payment.status),
  );
}

export function findLatestPaymentForInvoice(
  invoiceId: string,
  payments: Payment[],
): Payment | undefined {
  return payments.find((payment) => payment.invoiceId === invoiceId);
}

export function canCreatePaymentForInvoice(invoice: Invoice, payments: Payment[]): boolean {
  if (!isInvoicePayable(invoice)) return false;
  if (invoice.status === 'paid') return false;
  return !findActivePaymentForInvoice(invoice.id, payments);
}
