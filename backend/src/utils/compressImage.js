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
  return sharp(buffer)
    .rotate() // respect EXIF orientation before stripping it
    .resize({
      width: MAX_DIMENSION,
      height: MAX_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();
}
