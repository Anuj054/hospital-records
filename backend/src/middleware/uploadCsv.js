import multer from "multer";

function fileFilter(req, file, cb) {
  const isCsv =
    file.mimetype === "text/csv" ||
    file.mimetype === "application/vnd.ms-excel" ||
    file.originalname.toLowerCase().endsWith(".csv");
  if (!isCsv) return cb(new Error("Only .csv files are accepted"));
  cb(null, true);
}

export const uploadCsv = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
});
