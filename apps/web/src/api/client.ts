import { useAuthStore } from '../stores/auth.store';
import { copyForCode, FALLBACK_COPY, type ErrorCopy } from './error-copy';

const API_URL = import.meta.env.VITE_API_URL ?? '';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export function getErrorCode(error: unknown): string | undefined {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code?: unknown }).code === 'string'
  ) {
    return (error as { code: string }).code;
  }
  return undefined;
}

/**
 * Resolve any thrown value into reviewed, human copy.
 *
 * The backend `message` is never consulted. A body with no `code` - a framework
 * error, a proxy's HTML error page, anything unexpected - resolves to the
 * generic copy rather than leaking whatever prose it carried.
 */
export function getErrorCopy(error: unknown): ErrorCopy {
  const code = getErrorCode(error);
  if (code) return copyForCode(code);

  // Fetch rejects with TypeError when the request never reached the server.
  if (error instanceof TypeError) return copyForCode('NETWORK_ERROR');
  if (error instanceof Error && error.message === 'Session expired') {
    return copyForCode('AUTH_UNAUTHENTICATED');
  }
  return FALLBACK_COPY;
}

/** Convenience for the many places that need one line rather than the pair. */
export function getErrorMessage(error: unknown): string {
  const copy = getErrorCopy(error);
  return copy.detail ? `${copy.title} ${copy.detail}` : copy.title;
}

/** True when retrying the identical operation could plausibly succeed. */
export function isRetryable(error: unknown): boolean {
  return getErrorCopy(error).retryable;
}

let refreshPromise: Promise<boolean> | null = null;

async function refreshToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const currentRefreshToken = useAuthStore.getState().refreshToken;
    if (!currentRefreshToken) return false;

    try {
      const response = await fetch(`${API_URL}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: currentRefreshToken }),
      });

      if (!response.ok) return false;

      const data = (await response.json()) as ApiResponse<{
        user: { id: string; name: string; email: string; role: string; organizationId: string; businessId: string };
        accessToken: string;
        refreshToken: string;
      }>;

      useAuthStore.getState().setAuth(
        data.data.user,
        data.data.accessToken,
        data.data.refreshToken,
      );
      return true;
    } catch {
      return false;
    }
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

/**
 * One request path for the whole app.
 *
 * Returns the envelope's `data` plus its optional top-level `code`, which
 * success responses use for informational states such as
 * DOMAIN_VERIFICATION_PENDING - a 200 that is not an error but is not a
 * success either.
 *
 * On 401 it refreshes once (single-flight, shared by every concurrent caller)
 * and replays the request. A second 401 means the session is genuinely gone.
 */
export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<{ data: T; infoCode?: string }> {
  const buildHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };
    // Only declare a JSON body when there actually is one. Sending
    // `Content-Type: application/json` on a bodyless request (every DELETE)
    // makes Fastify reject it with "Body cannot be empty when content-type is
    // set" before the route is ever reached - which silently broke domain
    // removal from the UI while the service-level tests, which never go over
    // HTTP, all passed.
    if (options.body !== undefined && options.body !== null) {
      headers['Content-Type'] = 'application/json';
    }
    const { accessToken } = useAuthStore.getState();
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
    return headers;
  };

  let response = await fetch(`${API_URL}${path}`, { ...options, headers: buildHeaders() });

  if (response.status === 401) {
    const refreshed = await refreshToken();
    if (refreshed) {
      response = await fetch(`${API_URL}${path}`, { ...options, headers: buildHeaders() });
    }
    if (response.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
      throw new Error('Session expired');
    }
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw errorBody ?? { statusCode: response.status, code: 'INTERNAL_ERROR' };
  }

  // 204 and other empty bodies are legitimate; do not treat them as failures.
  const raw = await response.text();
  if (!raw) return { data: undefined as T };

  const body = JSON.parse(raw) as ApiResponse<T> & { code?: string };
  return body.code === undefined
    ? { data: body.data }
    : { data: body.data, infoCode: body.code };
}

/** The common case: the caller only wants the payload. */
export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { data } = await apiRequest<T>(path, options);
  return data;
}

/** @deprecated Use {@link apiRequest}; kept for call sites not yet migrated. */
export const apiFetchWithMeta = apiRequest;
