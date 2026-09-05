import { apiFetch } from './client';

export interface SimpleAuthResponse {
  success: boolean;
  message: string;
}

/**
 * Ask for a reset link.
 *
 * Resolves the same way whether or not the address has an account - the server
 * deliberately refuses to distinguish them, so the UI must not imply it can
 * either. The only failure worth surfacing is a deployment with no mailer.
 */
export function requestPasswordReset(email: string): Promise<SimpleAuthResponse> {
  return apiFetch<SimpleAuthResponse>('/api/v1/auth/password/forgot', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

/** Set a new password using the token from the emailed link. */
export function resetPassword(token: string, password: string): Promise<SimpleAuthResponse> {
  return apiFetch<SimpleAuthResponse>('/api/v1/auth/password/reset', {
    method: 'POST',
    body: JSON.stringify({ token, password }),
  });
}
