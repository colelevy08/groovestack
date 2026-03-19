// Shared utility functions used across multiple components.
import { USER_PROFILES } from '../constants';

// Maps a record condition grade to its display color — used by Badge and record list rows
export const condColor = (c) =>
  ({ M:"#10b981", NM:"#34d399", "VG+":"#60a5fa", VG:"#a78bfa",
     "G+":"#fb923c", G:"#f87171", F:"#9ca3af", P:"#6b7280" }[c] || "#666");

// Returns the user's profile data or a safe fallback object for unknown usernames
export const getProfile = (username) =>
  USER_PROFILES[username] || { displayName: username, bio: "", location: "", favGenre: "", accent: "#0ea5e9", followers: [] };

// Derives a 1-2 character avatar monogram by taking the first letter of each dot-separated name segment
export const getInitials = (username) =>
  username.split(".").map(w => w[0]?.toUpperCase() || "").join("").slice(0, 2);

// Picks a random color from the ACCENT_COLORS array — used when creating new records
export const randomAccent = (ACCENT_COLORS) =>
  ACCENT_COLORS[Math.floor(Math.random() * ACCENT_COLORS.length)];
