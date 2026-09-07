// Resolves the backend URL relative to whatever host the app was opened
// on (localhost, a LAN IP, etc.) so the same build works from other
// devices on the network without hardcoding an address. VITE_API_URL
// still wins when explicitly set (e.g. a real deployment).
export function getApiBaseUrl() {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  return `${window.location.protocol}//${window.location.hostname}:5050/api`;
}
