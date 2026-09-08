import axios from "axios";
import { getApiBaseUrl } from "./baseUrl";
import { clearCatalogCache } from "./catalogCache";

const client = axios.create({
  baseURL: getApiBaseUrl(),
  withCredentials: true,
});

// Any write to medicines/services/doctors drops the cached catalog, so an
// item added on the Catalog page appears in the billing dropdown on the next
// look rather than after the cache TTL. Doing it here — instead of in each
// handler — means it also covers writes added later.
const CATALOG_PATH = /^\/(medicines|services|doctors)\b/;

client.interceptors.response.use((response) => {
  const method = response.config.method?.toLowerCase();
  if (method && method !== "get" && CATALOG_PATH.test(response.config.url || "")) {
    clearCatalogCache();
  }
  return response;
});

export default client;
