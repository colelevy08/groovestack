// Auth utility — JWT-based auth via the Express backend.
// Custom auth endpoints on the Railway server (signup, login, profile).
// Includes retry logic for failed API calls (#19).
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

// Retry logic for failed API calls (#19)
// Retries up to `maxRetries` times with exponential backoff for network errors and 5xx responses.
async function fetchWithRetry(url, options = {}, maxRetries = 3) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, options);
      // Don't retry client errors (4xx), only server errors (5xx)
      if (res.ok || (res.status >= 400 && res.status < 500)) {
        return res;
      }
      // Server error — retry
      lastError = new Error(`Server error (${res.status})`);
    } catch (err) {
      // Network error — retry
      lastError = err;
    }

    // Wait before retrying: 500ms, 1000ms, 2000ms (exponential backoff)
    if (attempt < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, attempt)));
    }
  }
  throw lastError || new Error('Request failed after retries');
}

// Sign up — returns { token, user } or throws
export async function signUp({ email, password, username, displayName }) {
  let res;
  try {
    res = await fetchWithRetry(`${API_BASE}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, username, displayName }),
    }, 2);
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
    res = await fetchWithRetry(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }, 2);
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
    const res = await fetchWithRetry(`${API_BASE}/api/auth/me`, { headers: authHeaders() }, 2);
    if (!res.ok) { setToken(null); return null; }
    return await safeJson(res);
  } catch {
    return null;
  }
}

// Update profile (with retry)
export async function updateProfile(profile) {
  try {
    const res = await fetchWithRetry(`${API_BASE}/api/auth/profile`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(profile),
    }, 3);
    return res.ok;
  } catch {
    return false;
  }
}

// Update username — returns new token (with retry)
export async function updateUsername(username) {
  const res = await fetchWithRetry(`${API_BASE}/api/auth/username`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ username }),
  }, 2);
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data.error || 'Username change failed');
  if (data.token) setToken(data.token);
  return data;
}

// Check username availability (with retry)
export async function checkUsername(username) {
  try {
    const res = await fetchWithRetry(`${API_BASE}/api/auth/check-username/${encodeURIComponent(username)}`, {}, 1);
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
