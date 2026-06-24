import { useEffect, useRef } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from './ui/Toast';

interface PermissionRouteProps {
  requiredPermissions: string | string[];
  requireAll?: boolean;
}

export function PermissionRoute({ requiredPermissions, requireAll = false }: PermissionRouteProps) {
  const { hasPermission, hasAnyPermission } = useAuth();
  const { showToast } = useToast();
  const deniedRef = useRef(false);

  const permissions = Array.isArray(requiredPermissions)
    ? requiredPermissions
    : [requiredPermissions];

  const allowed = requireAll
    ? permissions.every((code) => hasPermission(code))
    : hasAnyPermission(permissions);

  useEffect(() => {
    if (!allowed && !deniedRef.current) {
      deniedRef.current = true;
      showToast('Access Denied: You do not have permission to view this page.', 'error');
    }
    if (allowed) {
      deniedRef.current = false;
    }
  }, [allowed, showToast]);

  if (!allowed) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
