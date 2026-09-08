// Shared cache slot for the medicines/services/doctors catalog. It lives in
// its own module so both the loader (api/catalog.js) and the axios
// interceptor that invalidates it (api/client.js) can reach it without
// importing each other.
export const catalogCache = { at: 0, value: null, inflight: null };

export function clearCatalogCache() {
  catalogCache.at = 0;
  catalogCache.value = null;
  catalogCache.inflight = null;
}
