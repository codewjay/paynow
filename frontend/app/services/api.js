import axios from 'axios';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'paynow.jwt';

export const apiBaseUrl =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  Constants.expoConfig?.extra?.apiBaseUrl ||
  Constants.manifest?.extra?.apiBaseUrl ||
  'http://localhost:5000';

export const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

let onUnauthorized = null;
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      if (onUnauthorized) onUnauthorized();
    }
    return Promise.reject(err);
  }
);

export async function saveToken(token) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}
export async function loadToken() {
  return SecureStore.getItemAsync(TOKEN_KEY);
}
export async function clearToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

// Surface a user-friendly message for any axios error.
export function errorMessage(err, fallback = 'Something went wrong') {
  return err?.response?.data?.error || err?.message || fallback;
}

// ── Endpoint wrappers ─────────────────────────────────────────────
export const authApi = {
  verifyToken: (idToken) => api.post('/api/auth/verify-token', { idToken }).then((r) => r.data),
  completeProfile: (name, username, upiId) =>
    api.post('/api/auth/complete-profile', { name, username, upiId }).then((r) => r.data.user),
};

export const userApi = {
  me: () => api.get('/api/users/me').then((r) => r.data.user),
  update: (patch) => api.put('/api/users/me', patch).then((r) => r.data.user),
  search: (email) => api.get('/api/users/search', { params: { email } }).then((r) => r.data.user),
  addFriend: (userId) => api.post(`/api/users/friends/${userId}`).then((r) => r.data.friend),
  friends: () => api.get('/api/users/friends').then((r) => r.data.friends),
  deleteMe: () => api.delete('/api/users/me').then((r) => r.data),
};

export const groupApi = {
  list: () => api.get('/api/groups').then((r) => r.data.groups),
  create: (data) => api.post('/api/groups', data).then((r) => r.data.group),
  get: (groupId) => api.get(`/api/groups/${groupId}`).then((r) => r.data),
  update: (groupId, patch) => api.put(`/api/groups/${groupId}`, patch).then((r) => r.data.group),
  addMember: (groupId, email) => api.post(`/api/groups/${groupId}/members`, { email }).then((r) => r.data.member),
  removeMember: (groupId, userId) => api.delete(`/api/groups/${groupId}/members/${userId}`).then((r) => r.data),
  leaveGroup: (groupId, userId) => api.delete(`/api/groups/${groupId}/members/${userId}`).then((r) => r.data),
  deleteGroup: (groupId) => api.delete(`/api/groups/${groupId}`).then((r) => r.data),
  balances: (groupId) => api.get(`/api/groups/${groupId}/balances`).then((r) => r.data.balances),
};

export const expenseApi = {
  list: (groupId) => api.get(`/api/expenses/group/${groupId}`).then((r) => r.data.expenses),
  create: (groupId, data) => api.post(`/api/expenses/group/${groupId}`, data).then((r) => r.data.expense),
  update: (expenseId, patch) => api.put(`/api/expenses/${expenseId}`, patch).then((r) => r.data.expense),
  remove: (expenseId) => api.delete(`/api/expenses/${expenseId}`).then((r) => r.data),
  activity: () => api.get('/api/expenses/activity').then((r) => r.data.expenses),
};

export const settlementApi = {
  initiate: (data) => api.post('/api/settlements/initiate', data).then((r) => r.data.settlement),
  confirm: (settlementId) => api.post(`/api/settlements/${settlementId}/confirm`).then((r) => r.data.settlement),
  dispute: (settlementId, reason) => api.post(`/api/settlements/${settlementId}/dispute`, { reason }).then((r) => r.data.settlement),
  byGroup: (groupId) => api.get(`/api/settlements/group/${groupId}`).then((r) => r.data.settlements),
  pending: () => api.get('/api/settlements/pending').then((r) => r.data.settlements),
};
