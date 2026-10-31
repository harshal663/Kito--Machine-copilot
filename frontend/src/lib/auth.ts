/**
 * Client-side authentication token management and session state.
 */

const TOKEN_KEY = "mc_access_token";
const USER_KEY = "mc_user_data";

export interface StoredUser {
  userId: string;
  email: string;
  fullName?: string | null | undefined;
  role?: string | undefined;
  onboardingCompleted?: boolean | undefined;
  onboardingStep?: number | undefined;
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Ignore storage quota or access errors in restricted modes
  }
}

export function clearStoredToken(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    // Ignore storage errors
  }
}

export function getStoredUser(): StoredUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

export function setStoredUser(user: StoredUser): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    // Ignore storage errors
  }
}

export function isAuthenticated(): boolean {
  return Boolean(getStoredToken());
}

export function signOut(): void {
  clearStoredToken();
  if (typeof window !== "undefined") {
    window.location.href = "/sign-in";
  }
}
