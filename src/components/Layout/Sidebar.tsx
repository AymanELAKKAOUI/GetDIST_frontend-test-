import { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Building2, ChevronUp, ClipboardList, Home, LogOut, Package, Shield, UserCircle, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import './Sidebar.css';

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function Sidebar() {
  const { user, logout, hasPermission, hasAnyPermission, isSupplierPortalUser } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const footerRef = useRef<HTMLDivElement>(null);

  const showUsers = !isSupplierPortalUser && hasPermission('rbac.manage');
  const showRoles = !isSupplierPortalUser && hasPermission('rbac.manage');
  const showSuppliers =
    !isSupplierPortalUser &&
    hasAnyPermission(['supplier.view', 'supplier.manage']);
  const showPurchaseOrders = hasAnyPermission([
    'purchase_order.view',
    'purchase_order.manage',
    'purchase_order.respond',
  ]);
  const showDeliveryNotes = hasPermission('delivery_note.view');

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (footerRef.current && !footerRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    setMenuOpen(false);
    logout();
    navigate('/login');
  };

  return (
    <aside className="sidebar" id="sidebar">
      <div className="sidebar__header">
        <div className="sidebar__logo" aria-hidden="true" />
        <div>
          <div className="sidebar__app-name">GetDIST Control</div>
          <div className="sidebar__app-subtitle">ERP Dashboard</div>
        </div>
      </div>

      <nav className="sidebar__nav">
        <div className="sidebar__section-label">System</div>
        <NavLink
          to="/"
          end
          className={({ isActive }) => `sidebar__item ${isActive ? 'sidebar__item--active' : ''}`}
          id="nav-home"
        >
          <Home size={18} />
          <span>Home</span>
        </NavLink>
        {showUsers && (
          <NavLink
            to="/users"
            className={({ isActive }) => `sidebar__item ${isActive ? 'sidebar__item--active' : ''}`}
            id="nav-users"
          >
            <Users size={18} />
            <span>Users</span>
          </NavLink>
        )}
        {showRoles && (
          <NavLink
            to="/roles"
            className={({ isActive }) => `sidebar__item ${isActive ? 'sidebar__item--active' : ''}`}
            id="nav-roles"
          >
            <Shield size={18} />
            <span>Roles</span>
          </NavLink>
        )}
        {showSuppliers && (
          <NavLink
            to="/suppliers"
            className={({ isActive }) => `sidebar__item ${isActive ? 'sidebar__item--active' : ''}`}
            id="nav-suppliers"
          >
            <Building2 size={18} />
            <span>Suppliers</span>
          </NavLink>
        )}
        {showPurchaseOrders && (
          <NavLink
            to="/purchase-orders"
            className={({ isActive }) => `sidebar__item ${isActive ? 'sidebar__item--active' : ''}`}
            id="nav-purchase-orders"
          >
            <Package size={18} />
            <span>Purchase Orders</span>
          </NavLink>
        )}
        {showDeliveryNotes && (
          <NavLink
            to="/delivery-notes"
            className={({ isActive }) => `sidebar__item ${isActive ? 'sidebar__item--active' : ''}`}
            id="nav-delivery-notes"
          >
            <ClipboardList size={18} />
            <span>Delivery Notes</span>
          </NavLink>
        )}
      </nav>

      <div className="sidebar__footer-wrap" ref={footerRef}>
        {menuOpen && (
          <div className="sidebar__menu" id="sidebar-user-menu" role="menu">
            <NavLink
              to="/profile"
              className="sidebar__menu-item"
              id="sidebar-menu-profile"
              role="menuitem"
              onClick={() => setMenuOpen(false)}
            >
              <UserCircle size={16} />
              <span>Profile</span>
            </NavLink>
            <button
              type="button"
              className="sidebar__menu-item sidebar__menu-item--logout"
              id="sidebar-menu-logout"
              role="menuitem"
              onClick={handleLogout}
            >
              <LogOut size={16} />
              <span>Logout</span>
            </button>
          </div>
        )}

        <button
          type="button"
          className={`sidebar__footer ${menuOpen ? 'sidebar__footer--open' : ''}`}
          id="sidebar-user-toggle"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
        >
          <div className="sidebar__avatar" aria-hidden="true">
            {user ? getInitials(user.fullName) : '?'}
          </div>
          <div className="sidebar__user-info">
            <div className="sidebar__user-name" id="sidebar-user-name">
              {user?.fullName ?? '—'}
            </div>
            <div className="sidebar__user-email" id="sidebar-user-email">
              {user?.email ?? '—'}
            </div>
          </div>
          <ChevronUp
            size={16}
            className={`sidebar__footer-chevron ${menuOpen ? 'sidebar__footer-chevron--open' : ''}`}
            aria-hidden="true"
          />
        </button>
      </div>
    </aside>
  );
}
