// API calls go to /api on the same origin as the app: in production the
// frontend deployment proxies /api through to the backend (see
// frontend/vercel.json), and locally the Vite dev server does the same (see
// vite.config.js).
//
// Same-origin matters for more than tidiness. Calling the backend on its own
// domain made the auth cookie a third-party cookie, which Safari blocks
// outright and Chrome partitions — that's why sessions kept disappearing
// between visits. It also put a CORS preflight in front of every write.
//
// VITE_API_URL still wins if you need to point somewhere else explicitly.
export function getApiBaseUrl() {
  return import.meta.env.VITE_API_URL || "/api";
}
