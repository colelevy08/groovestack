// Discogs price lookup — fetches market prices for vinyl records.
// Uses Discogs search API (free, rate-limited to 60/min with user agent).
import { API_BASE } from './api';
import { getToken } from './supabase';

const cache = new Map();

export async function getDiscogsPrice(album, artist) {
  const key = `${artist}||${album}`.toLowerCase();
  if (cache.has(key)) return cache.get(key);

  try {
    const token = getToken();
    const res = await fetch(
      `${API_BASE}/api/prices/lookup?album=${encodeURIComponent(album)}&artist=${encodeURIComponent(artist)}`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {} }
    );
    if (!res.ok) return null;
    const data = await res.json();
    cache.set(key, data);
    return data;
  } catch {
    return null;
  }
}
