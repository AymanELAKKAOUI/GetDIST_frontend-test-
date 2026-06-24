import axios from 'axios';

const TOKEN_KEY = 'getdist_token';

export const apiClient = axios.create({
  baseURL: '',
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const isLoginRequest = error.config?.url?.includes('/api/auth/login');
      if (!isLoginRequest) {
        localStorage.removeItem(TOKEN_KEY);
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

export { TOKEN_KEY };

export interface ApiErrorBody {
  error?: string;
  message?: string;
  details?: Array<{ field?: string; message?: string }>;
}

export function getApiErrorMessage(error: unknown, fallback = 'An unexpected error occurred.'): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiErrorBody | undefined;
    if (data?.message) return data.message;
    if (data?.error === 'CONFLICT') return 'A role with this name already exists.';
    if (error.response?.status === 429) return 'Too many attempts. Please try again later.';
  }
  return fallback;
}

export function getValidationErrors(error: unknown): Record<string, string> {
  const errors: Record<string, string> = {};
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiErrorBody | undefined;
    if (data?.details) {
      for (const detail of data.details) {
        if (detail.field && detail.message) {
          errors[detail.field] = detail.message;
        }
      }
    }
    if (data?.error === 'USER_EMAIL_CONFLICT') {
      errors.email = 'A user with this email already exists.';
    }
    if (data?.error === 'ROLE_REQUIRED') {
      errors.roles = 'At least one role must be assigned.';
    }
  }
  return errors;
}
