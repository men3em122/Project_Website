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

// ─── Upload an image to Cloudinary via the backend ────────────────────────────
// Called as soon as the user picks a file on the annotate page. The returned
// Cloudinary URL is kept in frontend state and reused for the AI service and
// when saving the annotated image to a category.
export interface UploadedImage {
  url: string;
  publicId: string;
  thumbnail: string;
  width: number;
  height: number;
}

export async function uploadImage(file: File | Blob, name?: string): Promise<UploadedImage> {
  const formData = new FormData();
  formData.append('image', file, name ?? (file instanceof File ? file.name : 'image.jpg'));

  const { data } = await api.post<UploadedImage>('/uploads', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}
