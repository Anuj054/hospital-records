import { getSupabase, REPORTS_BUCKET } from "../config/supabase.js";

const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

export async function uploadReportFile(storagePath, buffer, contentType) {
  const supabase = await getSupabase();
  const { error } = await supabase.storage
    .from(REPORTS_BUCKET)
    .upload(storagePath, buffer, { contentType, upsert: false });

  if (error) throw new Error(`Supabase upload failed: ${error.message}`);
  return storagePath;
}

export async function deleteReportFile(storagePath) {
  const supabase = await getSupabase();
  const { error } = await supabase.storage.from(REPORTS_BUCKET).remove([storagePath]);
  if (error) console.error(`Supabase delete failed for ${storagePath}: ${error.message}`);
}

// Removes many objects in one call. Unlike deleteReportFile this throws on
// failure: it backs the admin purge, where silently leaving a patient's
// x-rays in storage after reporting their record deleted would be worse
// than surfacing the error.
export async function deleteReportFiles(storagePaths) {
  if (!storagePaths.length) return 0;

  const supabase = await getSupabase();
  const { data, error } = await supabase.storage.from(REPORTS_BUCKET).remove(storagePaths);
  if (error) throw new Error(`Supabase delete failed: ${error.message}`);
  return data?.length ?? 0;
}

// Everything actually sitting under a patient's storage prefix. The purge
// uses this alongside the paths recorded in Mongo so that a file whose
// database row went missing at some point still gets cleaned up rather than
// lingering in the bucket forever.
export async function listPatientReportFiles(patientId) {
  const supabase = await getSupabase();
  const { data, error } = await supabase.storage.from(REPORTS_BUCKET).list(patientId, {
    limit: 1000,
  });
  if (error) throw new Error(`Supabase list failed for ${patientId}: ${error.message}`);
  return (data || []).filter((f) => f.id).map((f) => `${patientId}/${f.name}`);
}

export async function getReportSignedUrl(storagePath) {
  const supabase = await getSupabase();
  const { data, error } = await supabase.storage
    .from(REPORTS_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

  if (error) throw new Error(`Supabase signed URL failed: ${error.message}`);
  return data.signedUrl;
}

// Signs many paths in a single Supabase call. Signing one-by-one meant a
// patient with N reports triggered N API round trips (from the client, N
// separate HTTP requests to us as well) just to render their report list.
// Returns a { storagePath: signedUrl } map, omitting any path that failed
// so one bad object can't blank out the whole gallery.
export async function getReportSignedUrls(storagePaths) {
  if (!storagePaths.length) return {};

  const supabase = await getSupabase();
  const { data, error } = await supabase.storage
    .from(REPORTS_BUCKET)
    .createSignedUrls(storagePaths, SIGNED_URL_TTL_SECONDS);

  if (error) throw new Error(`Supabase signed URLs failed: ${error.message}`);

  const urls = {};
  for (const entry of data) {
    if (entry.signedUrl && !entry.error) urls[entry.path] = entry.signedUrl;
    else console.error(`Supabase signed URL failed for ${entry.path}: ${entry.error}`);
  }
  return urls;
}
