import multer from "multer";

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

function fileFilter(req, file, cb) {
  if (!ALLOWED_MIME.has(file.mimetype)) {
    return cb(new Error("Unsupported file type. Allowed: JPG, PNG, WEBP, PDF"));
  }
  cb(null, true);
}

// Memory storage: file lands in req.file.buffer so we can compress images
// before writing anything to disk (see utils/compressImage.js).
export const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB, pre-compression
});
