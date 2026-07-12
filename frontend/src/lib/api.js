// Centralized API configuration.
// Set VITE_API_URL in your hosting environment (e.g. https://api.yourdomain.com).
// Falls back to localhost for local development.

export const API_BASE =
  import.meta.env.VITE_API_URL || 'http://localhost:8001';

// Derive the WebSocket base from the API base (http -> ws, https -> wss).
export const WS_BASE = API_BASE.replace(/^http/, 'ws');

export function authHeaders() {
  const token = localStorage.getItem('ia_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}
