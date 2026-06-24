export type SupplierStatus =
  | 'draft'
  | 'pending_validation'
  | 'active'
  | 'inactive'
  | 'suspended';

export type PaymentMethod = 'check' | 'cash';
export type RiskLevel = 'low' | 'medium' | 'high';

export interface Supplier {
  id: string;
  companyId: string;
  name: string;
  taxIdentifier: string | null;
  email: string | null;
  phone: string | null;
  status: SupplierStatus;
  legalName: string | null;
  tradeName: string | null;
  rc: string | null;
  ice: string | null;
  ifNumber: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  contactName: string | null;
  website: string | null;
  bankName: string | null;
  ribIban: string | null;
  creditLimit: number | null;
  productCategories: string[];
  isStrategic: boolean;
  hasAlternative: boolean;
  riskLevel: string;
  paymentDeadlineDays: number;
  allowsPartialPayment: boolean;
  requiresFullPayment: boolean;
  requiresPaymentOnDelivery: boolean;
  preferredPaymentMethod: PaymentMethod | null;
  isActive: boolean;
}

export interface SupplierFormValues {
  name: string;
  taxIdentifier: string;
  email: string;
  phone: string;
  legalName: string;
  tradeName: string;
  rc: string;
  ice: string;
  ifNumber: string;
  address: string;
  city: string;
  country: string;
  contactName: string;
  website: string;
  bankName: string;
  ribIban: string;
  creditLimit: string;
  productCategoriesInput: string;
  isStrategic: boolean;
  hasAlternative: boolean;
  riskLevel: RiskLevel;
  paymentDeadlineDays: string;
  preferredPaymentMethod: '' | PaymentMethod;
  allowsPartialPayment: boolean;
  requiresFullPayment: boolean;
  requiresPaymentOnDelivery: boolean;
}

export function emptySupplierForm(): SupplierFormValues {
  return {
    name: '',
    taxIdentifier: '',
    email: '',
    phone: '',
    legalName: '',
    tradeName: '',
    rc: '',
    ice: '',
    ifNumber: '',
    address: '',
    city: '',
    country: '',
    contactName: '',
    website: '',
    bankName: '',
    ribIban: '',
    creditLimit: '',
    productCategoriesInput: '',
    isStrategic: false,
    hasAlternative: false,
    riskLevel: 'medium',
    paymentDeadlineDays: '0',
    preferredPaymentMethod: '',
    allowsPartialPayment: false,
    requiresFullPayment: false,
    requiresPaymentOnDelivery: false,
  };
}

export function supplierToFormValues(supplier: Supplier): SupplierFormValues {
  return {
    name: supplier.name,
    taxIdentifier: supplier.taxIdentifier ?? supplier.ice ?? '',
    email: supplier.email ?? '',
    phone: supplier.phone ?? '',
    legalName: supplier.legalName ?? '',
    tradeName: supplier.tradeName ?? '',
    rc: supplier.rc ?? '',
    ice: supplier.ice ?? '',
    ifNumber: supplier.ifNumber ?? '',
    address: supplier.address ?? '',
    city: supplier.city ?? '',
    country: supplier.country ?? '',
    contactName: supplier.contactName ?? '',
    website: supplier.website ?? '',
    bankName: supplier.bankName ?? '',
    ribIban: supplier.ribIban ?? '',
    creditLimit: supplier.creditLimit != null ? String(supplier.creditLimit) : '',
    productCategoriesInput: supplier.productCategories.join(', '),
    isStrategic: supplier.isStrategic,
    hasAlternative: supplier.hasAlternative,
    riskLevel: (supplier.riskLevel as RiskLevel) || 'medium',
    paymentDeadlineDays: String(supplier.paymentDeadlineDays),
    preferredPaymentMethod: supplier.preferredPaymentMethod ?? '',
    allowsPartialPayment: supplier.allowsPartialPayment,
    requiresFullPayment: supplier.requiresFullPayment,
    requiresPaymentOnDelivery: supplier.requiresPaymentOnDelivery,
  };
}

export function parseProductCategories(input: string): string[] {
  return input
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function formValuesToPayload(values: SupplierFormValues): Record<string, unknown> {
  const categories = parseProductCategories(values.productCategoriesInput);
  const ice = values.ice.trim() || values.taxIdentifier.trim() || null;

  return {
    name: values.name.trim(),
    taxIdentifier: values.taxIdentifier.trim() || ice,
    email: values.email.trim() || null,
    phone: values.phone.trim() || null,
    legalName: values.legalName.trim() || null,
    tradeName: values.tradeName.trim() || null,
    rc: values.rc.trim() || null,
    ice,
    ifNumber: values.ifNumber.trim() || null,
    address: values.address.trim() || null,
    city: values.city.trim() || null,
    country: values.country.trim() || null,
    contactName: values.contactName.trim() || null,
    website: values.website.trim() || null,
    bankName: values.bankName.trim() || null,
    ribIban: values.ribIban.trim() || null,
    creditLimit: values.creditLimit.trim() ? Number(values.creditLimit) : null,
    productCategories: categories,
    isStrategic: values.isStrategic,
    hasAlternative: values.hasAlternative,
    riskLevel: values.riskLevel,
    paymentDeadlineDays: Number(values.paymentDeadlineDays) || 0,
    preferredPaymentMethod: values.preferredPaymentMethod || null,
    allowsPartialPayment: values.allowsPartialPayment,
    requiresFullPayment: values.requiresFullPayment,
    requiresPaymentOnDelivery: values.requiresPaymentOnDelivery,
  };
}

export function formatSupplierStatus(status: SupplierStatus): string {
  const labels: Record<SupplierStatus, string> = {
    draft: 'Draft',
    pending_validation: 'Pending Validation',
    active: 'Active',
    inactive: 'Inactive',
    suspended: 'Suspended',
  };
  return labels[status];
}

export const SUPPLIER_STATUS_FILTER_OPTIONS: Array<{ value: '' | SupplierStatus; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'pending_validation', label: 'Pending Validation' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'inactive', label: 'Inactive' },
];
