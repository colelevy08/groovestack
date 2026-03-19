// Auth utility — JWT-based auth via the Express backend.
// Replaces Supabase with custom auth endpoints on the same server.
import { API_BASE } from './api';

const TOKEN_KEY = 'gs_auth_token';

// Get stored token
export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

// Store token
export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

// Auth headers for authenticated requests
function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

// Sign up — returns { token, user } or throws
export async function signUp({ email, password, username, displayName }) {
  const res = await fetch(`${API_BASE}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, username, displayName }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Signup failed');
  setToken(data.token);
  return data;
}

// Log in — returns { token, user } or throws
export async function signIn({ email, password }) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Login failed');
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
    return await res.json();
  } catch {
    return null;
  }
}

// Update profile
export async function updateProfile(profile) {
  const res = await fetch(`${API_BASE}/api/auth/profile`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(profile),
  });
  return res.ok;
}

// Update username — returns new token
export async function updateUsername(username) {
  const res = await fetch(`${API_BASE}/api/auth/username`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ username }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Username change failed');
  if (data.token) setToken(data.token);
  return data;
}

// Check username availability
export async function checkUsername(username) {
  try {
    const res = await fetch(`${API_BASE}/api/auth/check-username/${encodeURIComponent(username)}`);
    const data = await res.json();
    return data.available;
  } catch {
    return true; // assume available if server unreachable
  }
}

// Sign out
export function signOut() {
  setToken(null);
}

// For backward compat — components check `if (supabase)` to decide whether auth is enabled
// This is now always null since we removed Supabase
export const supabase = null;
