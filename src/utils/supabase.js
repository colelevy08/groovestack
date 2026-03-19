// Auth utility — JWT-based auth via the Express backend.
// Custom auth endpoints on the Railway server (signup, login, profile).
import { API_BASE } from './api';

const TOKEN_KEY = 'gs_auth_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

// Safe JSON parse — handles empty responses, HTML error pages, etc.
async function safeJson(res) {
  const text = await res.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch { return { error: text.slice(0, 200) }; }
}

// Sign up — returns { token, user } or throws
export async function signUp({ email, password, username, displayName }) {
  let res;
  try {
    res = await fetch(`${API_BASE}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, username, displayName }),
    });
  } catch (err) {
    throw new Error('Cannot reach the server. Is the backend running?');
  }
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data.error || `Signup failed (${res.status})`);
  setToken(data.token);
  return data;
}

// Log in — returns { token, user } or throws
export async function signIn({ email, password }) {
  let res;
  try {
    res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  } catch (err) {
    throw new Error('Cannot reach the server. Is the backend running?');
  }
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data.error || `Login failed (${res.status})`);
  setToken(data.token);
  return data;
}

// Get current user profile from token
export async function getMe() {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch(`${API_BASE}/api/auth/me`, { headers: authHeaders() });
    if (!res.ok) { setToken(null); return null; }
    return await safeJson(res);
  } catch {
    return null;
  }
}

// Update profile
export async function updateProfile(profile) {
  try {
    const res = await fetch(`${API_BASE}/api/auth/profile`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(profile),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Update username — returns new token
export async function updateUsername(username) {
  const res = await fetch(`${API_BASE}/api/auth/username`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ username }),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data.error || 'Username change failed');
  if (data.token) setToken(data.token);
  return data;
}

// Check username availability
export async function checkUsername(username) {
  try {
    const res = await fetch(`${API_BASE}/api/auth/check-username/${encodeURIComponent(username)}`);
    const data = await safeJson(res);
    return data.available !== false;
  } catch {
    return true;
  }
}

// Sign out
export function signOut() {
  setToken(null);
}

// Backward compat — components used to check `if (supabase)`
export const supabase = null;
