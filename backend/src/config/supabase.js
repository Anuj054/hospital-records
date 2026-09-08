export const REPORTS_BUCKET = "reports";

// The Supabase SDK is a ~9MB dependency tree that only the report
// upload/download paths touch, so both the import and the client are created
// on first use. That keeps it off the cold-start import graph that every
// other request pays for, and means a missing key surfaces as a 500 on the
// upload route rather than taking down the whole app at boot.
let clientPromise = null;

export function getSupabase() {
  if (!clientPromise) {
    clientPromise = (async () => {
      if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env");
      }
      const { createClient } = await import("@supabase/supabase-js");
      // Service-role client: full storage access, server-side only. Never
      // expose this key to the frontend — it bypasses bucket privacy.
      return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    })().catch((err) => {
      clientPromise = null; // don't cache the failure — allow a retry
      throw err;
    });
  }
  return clientPromise;
}
