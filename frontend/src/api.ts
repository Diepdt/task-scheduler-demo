export interface User {
  id: number;
  name: string;
  email: string;
  phone: string;
  roles?: string[];
  permissions?: string[];
}

let accessToken: string | null = null;

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export async function refreshAccessToken(): Promise<string | null> {
  try {
    const res = await fetch('/auth/refresh', {
      method: 'POST',
      credentials: 'include'
    });
    if (!res.ok) throw new Error('Refresh failed');
    const data = await res.json();
    accessToken = data.access_token;
    return accessToken;
  } catch (error) {
    accessToken = null;
    return null;
  }
}

export async function authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  options.headers = options.headers || {};
  options.credentials = 'include';
  
  const headers = options.headers as Record<string, string>;
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  try {
    const res = await fetch(url, options);
    if (res.status === 401) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        headers['Authorization'] = `Bearer ${newToken}`;
        return fetch(url, options);
      } else {
        localStorage.removeItem('user');
        window.dispatchEvent(new Event('auth-change'));
        throw new Error('Session expired. Please log in again.');
      }
    }
    return res;
  } catch (err: any) {
    if (err.message?.includes('Session expired')) {
      throw err;
    }
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers['Authorization'] = `Bearer ${newToken}`;
      return fetch(url, options);
    } else {
      localStorage.removeItem('user');
      window.dispatchEvent(new Event('auth-change'));
      throw new Error('Session expired. Please log in again.');
    }
  }
}

export function hasPermission(permissionName: string): boolean {
  const userStr = localStorage.getItem('user');
  if (!userStr) return false;
  try {
    const user = JSON.parse(userStr) as User;
    if (user.roles?.includes('ADMIN')) return true;
    return !!user.permissions?.includes(permissionName);
  } catch (e) {
    return false;
  }
}
