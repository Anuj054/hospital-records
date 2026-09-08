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
