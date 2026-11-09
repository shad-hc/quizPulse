import type { ApiEnvelope, TokenPair } from '../types/api';

const BASE =  'http://localhost:4000/api';

// Endpoints where a 401 means "bad credentials", not "session expired".
const AUTH_PATHS = ['/auth/login', '/auth/signup', '/auth/refresh'];

export class ApiError extends Error {
  constructor(message: string, public status: number, public details?: unknown) {
    super(message);
    this.name = 'ApiError';
  }
}

export function getErrorMessage(err: unknown, fallback = 'Something went wrong'): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

function getToken(): string | null {
  return localStorage.getItem('accessToken');
}

function isEnvelope(body: unknown): body is ApiEnvelope<unknown> {
  return typeof body === 'object' && body !== null
    && typeof (body as { success?: unknown }).success === 'boolean';
}


function unwrap<T>(body: unknown): T {
  return (isEnvelope(body) ? body.data : body) as T;
}


function extractErrorMessage(body: unknown): string {
  if (typeof body === 'object' && body !== null) {
    const { message, error } = body as { message?: unknown; error?: unknown };
    if (typeof message === 'string' && message) return message;
    if (typeof error === 'string' && error) return error;
  }
  return 'Request failed';
}

async function parseJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function refreshTokens(): Promise<boolean> {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) return false;

  const res = await fetch(`${BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) return false;

  const tokens = unwrap<Partial<TokenPair> | undefined>(await parseJson(res));
  if (!tokens?.accessToken || !tokens.refreshToken) return false;

  localStorage.setItem('accessToken', tokens.accessToken);
  localStorage.setItem('refreshToken', tokens.refreshToken);
  return true;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  isRetry = false
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && !AUTH_PATHS.includes(path)) {
    if (!isRetry && await refreshTokens()) {
      return request<T>(method, path, body, true);
    }
    localStorage.clear();
    window.location.href = '/login';
  }

  const data = await parseJson(res);
  if (!res.ok) {
    throw new ApiError(
      extractErrorMessage(data),
      res.status,
      isEnvelope(data) ? data.errors : undefined
    );
  }
  return unwrap<T>(data);
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};

export default api;
