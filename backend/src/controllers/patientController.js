import path from "path";
import Patient from "../models/Patient.js";
import { generatePatientId } from "../utils/generatePatientId.js";
import { compressImage } from "../utils/compressImage.js";
import {
  uploadReportFile,
  deleteReportFile,
  getReportSignedUrl,
} from "../utils/reportsStorage.js";

export async function createPatient(req, res) {
  const { name, age, gender, phone, address } = req.body;
  if (!name) return res.status(400).json({ message: "name is required" });

  const patientId = await generatePatientId();
  const patient = await Patient.create({
    patientId,
    name,
    age,
    gender: gender?.toLowerCase(),
    phone,
    address,
  });

  res.status(201).json(patient);
}

export async function listPatients(req, res) {
  const { q } = req.query;
  const filter = q
    ? {
        $or: [
          { patientId: new RegExp(q, "i") },
          { name: new RegExp(q, "i") },
          { phone: new RegExp(q, "i") },
        ],
      }
    : {};

  const patients = await Patient.find(filter).sort({ createdAt: -1 }).limit(50).lean();
  res.json(patients);
}

export async function getPatient(req, res) {
  const patient = await Patient.findOne({ patientId: req.params.patientId }).lean();
  if (!patient) return res.status(404).json({ message: "Patient not found" });
  res.json(patient);
}

export async function updatePatient(req, res) {
  const { name, age, gender, phone, address } = req.body;
  const patient = await Patient.findOneAndUpdate(
    { patientId: req.params.patientId },
    { name, age, gender: gender?.toLowerCase(), phone, address },
    { new: true, runValidators: true }
  );
  if (!patient) return res.status(404).json({ message: "Patient not found" });
  res.json(patient);
}

export async function uploadReport(req, res) {
  const patient = await Patient.findOne({ patientId: req.params.patientId });
  if (!patient) return res.status(404).json({ message: "Patient not found" });
  if (!req.file) return res.status(400).json({ message: "No file uploaded" });

  const { category } = req.body;
  const isImage = req.file.mimetype.startsWith("image/");

  const buffer = isImage ? await compressImage(req.file.buffer) : req.file.buffer;
  const contentType = isImage ? "image/jpeg" : req.file.mimetype;
  const ext = isImage ? ".jpg" : path.extname(req.file.originalname);
  const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
  const storagePath = `${req.params.patientId}/${filename}`;

  await uploadReportFile(storagePath, buffer, contentType);

  patient.reports.push({
    category: category?.toLowerCase() || "other",
    originalName: req.file.originalname,
    storedPath: storagePath,
  });
  await patient.save();

  res.status(201).json(patient.reports[patient.reports.length - 1]);
}

export async function getReportUrl(req, res) {
  const patient = await Patient.findOne({ patientId: req.params.patientId }).lean();
  if (!patient) return res.status(404).json({ message: "Patient not found" });

  const report = patient.reports.find((r) => r._id.toString() === req.params.reportId);
  if (!report) return res.status(404).json({ message: "Report not found" });

  const url = await getReportSignedUrl(report.storedPath);
  res.json({ url });
}

export async function deleteReport(req, res) {
  const patient = await Patient.findOne({ patientId: req.params.patientId });
  if (!patient) return res.status(404).json({ message: "Patient not found" });

  const report = patient.reports.find((r) => r._id.toString() === req.params.reportId);
  if (report) await deleteReportFile(report.storedPath);

  patient.reports = patient.reports.filter(
    (r) => r._id.toString() !== req.params.reportId
  );
  await patient.save();
  res.json({ message: "Report deleted" });
}
