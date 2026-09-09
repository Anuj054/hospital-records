const MAX_DIMENSION = 1920;
const JPEG_QUALITY = 80;

// sharp ships ~26MB of platform-specific native binaries and is only needed
// by the report-upload endpoint, so it's imported on first use rather than at
// module load — otherwise every request's cold start pays to dlopen it.
let sharpPromise = null;
function loadSharp() {
  if (!sharpPromise) sharpPromise = import("sharp").then((m) => m.default);
  return sharpPromise;
}

// Resizes down (never up) and re-encodes as JPEG to keep report/x-ray
// storage small without visibly hurting readability.
export async function compressImage(buffer) {
  const sharp = await loadSharp();
  try {
    return await sharp(buffer)
      .rotate() // respect EXIF orientation before stripping it
      .resize({
        width: MAX_DIMENSION,
        height: MAX_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: JPEG_QUALITY })
      .toBuffer();
  } catch (err) {
    // A truncated or malformed upload is the caller's problem, not a server
    // fault — without this, sharp's decode error surfaced as a bare 500
    // reading "Input buffer has corrupt header: VipsJpeg...".
    const badImage = new Error(
      "That image could not be read — it may be corrupt or only partly uploaded. Try again, or re-save the file."
    );
    badImage.status = 400;
    badImage.cause = err;
    throw badImage;
  }
}
