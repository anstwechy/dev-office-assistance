const KEY = "office_jwt";
const USER_KEY = "office_user";

export function getStoredToken(): string | null {
  return localStorage.getItem(KEY);
}

export function setAuthSession(token: string, user: unknown) {
  localStorage.setItem(KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuthSession() {
  localStorage.removeItem(KEY);
  localStorage.removeItem(USER_KEY);
}

export function getStoredUser<T>(): T | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

let dynamicGetter: (() => string | null) | null = null;
export function setTokenGetter(fn: (() => string | null) | null) {
  dynamicGetter = fn;
}

export function getActiveAccessToken(): string | null {
  if (dynamicGetter) return dynamicGetter();
  return getStoredToken();
}
