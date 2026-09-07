import sharp from "sharp";

const MAX_DIMENSION = 1920;
const JPEG_QUALITY = 80;

// Resizes down (never up) and re-encodes as JPEG to keep report/x-ray
// storage small without visibly hurting readability.
export async function compressImage(buffer) {
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
