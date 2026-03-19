// Thin client wrapper around the /api/verify-vinyl endpoint on the Express proxy server (server.js).
// The Express server forwards the image to Claude Opus vision AI, which returns a pass/fail with a message.
// Called by VinylCamera in AddRecordModal after the user captures a photo.
import { API_BASE } from './api';

/**
 * Calls the Groovestack API server to verify a vinyl record image
 * using Claude Opus vision AI.
 *
 * @param {string} imageBase64 - Base64-encoded image data (no data: prefix)
 * @param {string} mediaType   - MIME type e.g. "image/jpeg"
 * @returns {Promise<{verified: boolean, message: string}>}
 */
export async function verifyVinyl(imageBase64, mediaType = 'image/jpeg') {
  const response = await fetch(`${API_BASE}/api/verify-vinyl`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64, mediaType }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Server error ${response.status}`);
  }

  return response.json(); // { verified: boolean, message: string }
}
