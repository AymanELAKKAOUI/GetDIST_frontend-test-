import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiClient, TOKEN_KEY } from '../api/client';

export interface AuthUser {
  id: string;
  companyId: string;
  email: string;
  fullName: string;
  supplierId: string | null;
}

interface LoginResponse {
  token: string;
  expiresIn: number;
  user: AuthUser;
}

interface MeResponse {
  user: AuthUser;
  permissions: string[];
}

interface AuthContextValue {
  user: AuthUser | null;
  permissions: string[];
  token: string | null;
  isLoading: boolean;
  isSupplierPortalUser: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasPermission: (code: string) => boolean;
  hasAnyPermission: (codes: string[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [isLoading, setIsLoading] = useState(!!localStorage.getItem(TOKEN_KEY));

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    setPermissions([]);
  }, []);

  const fetchProfile = useCallback(async () => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (!storedToken) {
      setIsLoading(false);
      return;
    }

    try {
      const { data } = await apiClient.get<MeResponse>('/api/auth/me');
      setUser(data.user);
      setPermissions(data.permissions);
      setToken(storedToken);
    } catch {
      logout();
    } finally {
      setIsLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await apiClient.post<LoginResponse>('/api/auth/login', { email, password });
    localStorage.setItem(TOKEN_KEY, data.token);
    setToken(data.token);
    setUser(data.user);

    const me = await apiClient.get<MeResponse>('/api/auth/me');
    setPermissions(me.data.permissions);
  }, []);

  const hasPermission = useCallback(
    (code: string) => permissions.includes(code),
    [permissions],
  );

  const hasAnyPermission = useCallback(
    (codes: string[]) => codes.some((code) => permissions.includes(code)),
    [permissions],
  );

  const isSupplierPortalUser = user?.supplierId != null;

  const value = useMemo(
    () => ({
      user,
      permissions,
      token,
      isLoading,
      isSupplierPortalUser,
      login,
      logout,
      hasPermission,
      hasAnyPermission,
    }),
    [
      user,
      permissions,
      token,
      isLoading,
      isSupplierPortalUser,
      login,
      logout,
      hasPermission,
      hasAnyPermission,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
