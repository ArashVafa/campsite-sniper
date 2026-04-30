import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from './constants';

const TOKEN_KEY = 'cs_token';

// ── Token helpers ──────────────────────────────────────────────────────────

export async function getToken() {
  return await SecureStore.getItemAsync(TOKEN_KEY);
}

export async function saveToken(token) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function deleteToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

// ── Axios instance ─────────────────────────────────────────────────────────

const api = axios.create({ baseURL: API_BASE_URL });

api.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;

// ── Auth ───────────────────────────────────────────────────────────────────

export const authApi = {
  login: (email, password) =>
    api.post('/api/auth/login', { email, password }),

  register: (email, name, password) =>
    api.post('/api/auth/register', { email, name, password }),

  me: () =>
    api.get('/api/auth/me'),

  forgotPassword: (email) =>
    api.post('/api/auth/forgot-password', { email }),

  updateProfile: (data) =>
    api.patch('/api/auth/profile', data),
};

// ── Watches ────────────────────────────────────────────────────────────────

export const watchesApi = {
  list: () =>
    api.get('/api/watches'),

  create: (data) =>
    api.post('/api/watches', data),

  remove: (id) =>
    api.delete(`/api/watches/${id}`),
};

// ── Dashboard ──────────────────────────────────────────────────────────────

export const dashboardApi = {
  stats: () =>
    api.get('/api/stats'),

  activity: (limit = 20) =>
    api.get('/api/activity', { params: { limit } }),
};

// ── Campgrounds ────────────────────────────────────────────────────────────

export const campgroundsApi = {
  search: (q, radius = 50) =>
    api.get('/api/campgrounds/search', { params: { q, radius } }),

  attributes: (id) =>
    api.get(`/api/campgrounds/${id}/attributes`),
};

// ── Dates ──────────────────────────────────────────────────────────────────

export const datesApi = {
  expand: (start, end, pattern, min_nights, max_nights) =>
    api.post('/api/dates/expand', { start, end, pattern, min_nights, max_nights }),
};
