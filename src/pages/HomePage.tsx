import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, CalendarDays, ClipboardList, CreditCard, FileText, Landmark, Package, Shield, UserCircle, Users } from 'lucide-react';
import { apiClient } from '../api/client';
import { Spinner } from '../components/ui/Spinner';
import { useAuth } from '../context/AuthContext';
import { PaymentTrackingDashboard } from '../components/home/PaymentTrackingDashboard';
import { fetchAllInvoices, formatMoney, type Invoice } from '../types/invoice';
import './HomePage.css';

interface QuickLink {
  id: string;
  label: string;
  description: string;
  to: string;
  icon: React.ReactNode;
}

function SupplierHomeTotal() {
  const { hasPermission } = useAuth();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  useEffect(() => {
    if (!hasPermission('invoice.view')) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetchAllInvoices(async (offset, limit) => {
      const { data } = await apiClient.get<{ invoices: Invoice[] }>('/api/invoices', {
        params: { limit, offset },
      });
      return data.invoices;
    })
      .then((result) => {
        if (!cancelled) setInvoices(result);
      })
      .catch(() => {
        if (!cancelled) setInvoices([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [hasPermission]);

  const totalAmount = invoices.reduce((sum, invoice) => sum + (invoice.totalAmount ?? 0), 0);
  const currency = invoices.find((invoice) => invoice.currency)?.currency ?? 'MAD';
  const withAmount = invoices.filter((invoice) => invoice.totalAmount != null).length;

  if (loading) {
    return (
      <div className="home-supplier-total home-supplier-total--loading">
        <Spinner size={28} />
      </div>
    );
  }

  return (
    <div className="home-supplier-total" id="supplier-invoice-total">
      <div className="home-supplier-total__label">Total Invoiced</div>
      <div className="home-supplier-total__value">{formatMoney(totalAmount, currency)}</div>
      <p className="home-supplier-total__meta">
        {invoices.length === 0
          ? 'No invoices submitted yet.'
          : `${invoices.length} invoice${invoices.length !== 1 ? 's' : ''}${
              withAmount < invoices.length
                ? ` · ${withAmount} with verified amounts`
                : ''
            }`}
      </p>
    </div>
  );
}

export function HomePage() {
  const { user, hasPermission, hasAnyPermission, isSupplierPortalUser } = useAuth();
  const firstName = user?.fullName?.split(' ')[0] ?? 'User';

  const links: QuickLink[] = [];

  if (!isSupplierPortalUser && hasPermission('rbac.manage')) {
    links.push(
      {
        id: 'home-link-users',
        label: 'Users',
        description: 'Manage team members and access levels',
        to: '/users',
        icon: <Users size={20} />,
      },
      {
        id: 'home-link-roles',
        label: 'Roles',
        description: 'Configure roles and permissions',
        to: '/roles',
        icon: <Shield size={20} />,
      },
    );
  }

  if (!isSupplierPortalUser && hasAnyPermission(['supplier.view', 'supplier.manage'])) {
    links.push({
      id: 'home-link-suppliers',
      label: 'Suppliers',
      description: 'Vendor profiles and portal accounts',
      to: '/suppliers',
      icon: <Building2 size={20} />,
    });
  }

  if (hasAnyPermission(['purchase_order.view', 'purchase_order.manage', 'purchase_order.respond'])) {
    links.push({
      id: 'home-link-purchase-orders',
      label: 'Purchase Orders',
      description: 'Create and manage purchase orders',
      to: '/purchase-orders',
      icon: <Package size={20} />,
    });
  }

  if (hasPermission('delivery_note.view')) {
    links.push({
      id: 'home-link-delivery-notes',
      label: 'Delivery Notes',
      description: 'Review and verify delivery notes',
      to: '/delivery-notes',
      icon: <ClipboardList size={20} />,
    });
  }

  if (hasPermission('invoice.view')) {
    links.push({
      id: 'home-link-invoices',
      label: 'Invoices',
      description: 'Review and verify received invoices',
      to: '/invoices',
      icon: <FileText size={20} />,
    });
  }

  if (hasPermission('payment.view')) {
    links.push({
      id: 'home-link-payments',
      label: 'Payments',
      description: 'Create, evaluate, and approve payments',
      to: '/payments',
      icon: <CreditCard size={20} />,
    });
  }

  if (hasAnyPermission(['check.view', 'check.create'])) {
    links.push(
      {
        id: 'home-link-checks',
        label: 'Checks',
        description: 'Track and manage check lifecycle',
        to: '/checks',
        icon: <Landmark size={20} />,
      },
      {
        id: 'home-link-check-calendar',
        label: 'Calendar',
        description: 'View check receipts and holidays',
        to: '/checks/calendar',
        icon: <CalendarDays size={20} />,
      },
    );
  }

  links.push({
    id: 'home-link-profile',
    label: 'Profile',
    description: 'Account details and password',
    to: '/profile',
    icon: <UserCircle size={20} />,
  });

  if (isSupplierPortalUser) {
    return (
      <div className="home-page" id="home-page">
        <h1 className="page-title" id="home-title">
          Welcome back, {firstName}
        </h1>
        <p className="home-page__subtitle">
          Overview of your submitted invoices with the company.
        </p>
        <SupplierHomeTotal />
      </div>
    );
  }

  if (hasPermission('payment.view')) {
    return (
      <div className="home-page" id="home-page">
        <PaymentTrackingDashboard />
      </div>
    );
  }

  return (
    <div className="home-page" id="home-page">
      <h1 className="page-title" id="home-title">
        Welcome back, {firstName}
      </h1>
      <p className="home-page__subtitle">
        FINTRAC Control ERP Dashboard — pick a module below to get started.
      </p>

      <div className="home-page__grid">
        {links.map((link) => (
          <Link key={link.id} to={link.to} className="home-card" id={link.id}>
            <div className="home-card__icon">{link.icon}</div>
            <div>
              <div className="home-card__title">{link.label}</div>
              <div className="home-card__desc">{link.description}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
