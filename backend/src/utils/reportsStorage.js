import { supabase, REPORTS_BUCKET } from "../config/supabase.js";

const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

export async function uploadReportFile(storagePath, buffer, contentType) {
  const { error } = await supabase.storage
    .from(REPORTS_BUCKET)
    .upload(storagePath, buffer, { contentType, upsert: false });

  if (error) throw new Error(`Supabase upload failed: ${error.message}`);
  return storagePath;
}

export async function deleteReportFile(storagePath) {
  const { error } = await supabase.storage.from(REPORTS_BUCKET).remove([storagePath]);
  if (error) console.error(`Supabase delete failed for ${storagePath}: ${error.message}`);
}

export async function getReportSignedUrl(storagePath) {
  const { data, error } = await supabase.storage
    .from(REPORTS_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

  if (error) throw new Error(`Supabase signed URL failed: ${error.message}`);
  return data.signedUrl;
}
