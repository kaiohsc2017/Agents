import axios, { type AxiosInstance } from 'axios';

const AGENTS_BASE_URL = import.meta.env.VITE_AGENTS_API_URL ?? '/agents';

const agentsApi: AxiosInstance = axios.create({
  baseURL: AGENTS_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 20_000,
});

agentsApi.interceptors.request.use((config) => {
  const token =
    localStorage.getItem('agentia_token') ??
    localStorage.getItem('voipia_token') ??
    localStorage.getItem('asteriskia_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

agentsApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      window.dispatchEvent(new Event('voipia:logout'));
    }
    return Promise.reject(error);
  }
);

export function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const detail = (error.response?.data as { detail?: string | Array<{ msg?: string }> } | undefined)?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail) && detail.length > 0) {
      const joined = detail.map((d) => d.msg).filter(Boolean).join('; ');
      if (joined) return joined;
    }
    const message = (error.response?.data as { message?: string } | undefined)?.message;
    if (message) return message;
  }
  return fallback;
}

export default agentsApi;
