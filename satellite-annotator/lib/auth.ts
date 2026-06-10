'use client';

/**
 * Thin auth helpers — token storage only.
 * All sign-in/sign-up/sign-out logic is handled via TanStack Query hooks in
 * hooks/useAuth.ts. These helpers exist so non-hook code can still read the token.
 */

export const TOKEN_KEY = 'satellite_token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

/** @deprecated Use useCurrentUser() from hooks/useAuth instead */
export function getCurrentUser() {
  return null;
}

/** @deprecated Use useSignOut() from hooks/useAuth instead */
export function signOut() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY);
  }
}
