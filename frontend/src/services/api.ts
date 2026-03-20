import axios from "axios";
import { buildAuthState, getAuthState, setAuthState } from "../models/auth";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";

export const api = axios.create({
  baseURL: API_URL,
});

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const auth = getAuthState();
  if (!auth?.refreshToken) return null;
  const response = await axios.post(`${API_URL}/auth/refresh`, {
    refreshToken: auth.refreshToken,
  });
  const next = response.data.data as { accessToken: string; refreshToken: string };
  setAuthState(buildAuthState(next));
  return next.accessToken;
}

api.interceptors.request.use((config) => {
  const auth = getAuthState();
  if (auth?.accessToken) {
    config.headers.Authorization = `Bearer ${auth.accessToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config as { _retry?: boolean } & typeof error.config;
    if (error.response?.status !== 401 || original?._retry) {
      return Promise.reject(error);
    }
    original._retry = true;

    try {
      if (!isRefreshing) {
        isRefreshing = true;
        refreshPromise = refreshAccessToken().finally(() => {
          isRefreshing = false;
          refreshPromise = null;
        });
      }
      const token = await refreshPromise;
      if (!token) throw error;
      original.headers.Authorization = `Bearer ${token}`;
      return api.request(original);
    } catch {
      setAuthState(null);
      return Promise.reject(error);
    }
  },
);
