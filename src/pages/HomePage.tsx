import { Link } from 'react-router-dom';
import { Building2, ClipboardList, Package, Shield, UserCircle, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './HomePage.css';

interface QuickLink {
  id: string;
  label: string;
  description: string;
  to: string;
  icon: React.ReactNode;
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
      description: isSupplierPortalUser
        ? 'View and respond to client purchase orders'
        : 'Create and manage purchase orders',
      to: '/purchase-orders',
      icon: <Package size={20} />,
    });
  }

  if (hasPermission('delivery_note.view')) {
    links.push({
      id: 'home-link-delivery-notes',
      label: 'Delivery Notes',
      description: isSupplierPortalUser
        ? 'Upload and track delivery note PDFs'
        : 'Review and verify delivery notes',
      to: '/delivery-notes',
      icon: <ClipboardList size={20} />,
    });
  }

  links.push({
    id: 'home-link-profile',
    label: 'Profile',
    description: 'Account details and password',
    to: '/profile',
    icon: <UserCircle size={20} />,
  });

  return (
    <div className="home-page" id="home-page">
      <h1 className="page-title" id="home-title">
        Welcome back, {firstName}
      </h1>
      <p className="home-page__subtitle">
        {isSupplierPortalUser
          ? 'Supplier Portal — access your account settings from the sidebar.'
          : 'GetDIST Control ERP Dashboard — pick a module below to get started.'}
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
