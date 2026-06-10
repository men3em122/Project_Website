import axios from 'axios';

const TOKEN_KEY = 'satellite_token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      removeToken();
    }
    return Promise.reject(error);
  }
);

// ─── Fetch a blob/object URL and return a Blob ────────────────────────────────
// Used in the annotate page to convert a local blob:// URL into a File
// before uploading to the backend.
export async function fetchBlob(url: string): Promise<Blob> {
  const response = await fetch(url);
  return response.blob();
}

// ─── Check if a URL is already hosted externally (e.g. Cloudinary) ───────────
export function isHostedUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://');
}
