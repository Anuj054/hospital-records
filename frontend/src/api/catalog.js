import client from "./client";
import { catalogCache } from "./catalogCache";

const TTL_MS = 5 * 60 * 1000;

// BillForm remounts every time "+ Add Items" is toggled and on every visit
// to a patient, and it used to refetch all medicines, services and doctors
// each time — three requests, each a full round trip, for data that barely
// changes. Served from memory instead, and invalidated immediately by the
// interceptor in api/client.js when anything writes to those collections.
export function loadCatalog() {
  if (catalogCache.value && Date.now() - catalogCache.at < TTL_MS) {
    return Promise.resolve(catalogCache.value);
  }
  if (catalogCache.inflight) return catalogCache.inflight;

  catalogCache.inflight = Promise.all([
    client.get("/medicines"),
    client.get("/services"),
    client.get("/doctors"),
  ])
    .then(([meds, services, doctors]) => {
      const value = {
        catalog: [
          ...meds.data.map((m) => ({ ...m, kind: "Medicine" })),
          ...services.data.map((s) => ({ ...s, kind: "Service" })),
        ],
        doctors: doctors.data,
      };
      catalogCache.value = value;
      catalogCache.at = Date.now();
      catalogCache.inflight = null;
      return value;
    })
    .catch((err) => {
      catalogCache.inflight = null;
      throw err;
    });

  return catalogCache.inflight;
}
