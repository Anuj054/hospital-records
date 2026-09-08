import path from "path";
import Patient from "../models/Patient.js";
import { generatePatientId } from "../utils/generatePatientId.js";
import { compressImage } from "../utils/compressImage.js";
import { escapeRegex } from "../utils/escapeRegex.js";
import {
  uploadReportFile,
  deleteReportFile,
  getReportSignedUrl,
  getReportSignedUrls,
} from "../utils/reportsStorage.js";

// Fields the patient list needs — the full documents also carry every
// report's metadata, which the table never renders.
const LIST_FIELDS = "patientId name age gender phone createdAt";

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
  // escapeRegex: the raw query used to be interpolated into a RegExp, so an
  // unbalanced "(" threw and a pattern like "(a+)+$" was a ReDoS.
  const filter = q
    ? (() => {
        const rx = new RegExp(escapeRegex(q.trim()), "i");
        return { $or: [{ patientId: rx }, { name: rx }, { phone: rx }] };
      })()
    : {};

  const patients = await Patient.find(filter, LIST_FIELDS)
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  res.json(patients);
}

export async function getPatient(req, res) {
  const patient = await Patient.findOne({ patientId: req.params.patientId }).lean();
  if (!patient) return res.status(404).json({ message: "Patient not found" });

  // Sign every report in one Supabase call and hand the URLs back with the
  // record, rather than having the page fire one request per report card
  // after it mounts. A storage hiccup shouldn't take the whole page down, so
  // fall back to null URLs and let the cards show their placeholder.
  let reportUrls = {};
  try {
    reportUrls = await getReportSignedUrls(patient.reports.map((r) => r.storedPath));
  } catch (err) {
    console.error(`Could not sign report URLs for ${patient.patientId}: ${err.message}`);
  }

  res.json({
    ...patient,
    reports: patient.reports.map((r) => ({ ...r, url: reportUrls[r.storedPath] || null })),
  });
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
  if (!req.file) return res.status(400).json({ message: "No file uploaded" });

  const patient = await Patient.findOne({ patientId: req.params.patientId });
  if (!patient) return res.status(404).json({ message: "Patient not found" });

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

  const saved = patient.reports[patient.reports.length - 1];
  // Return the URL alongside the new report so the page can render it
  // immediately without a follow-up round trip.
  let url = null;
  try {
    url = await getReportSignedUrl(storagePath);
  } catch (err) {
    console.error(`Could not sign freshly uploaded ${storagePath}: ${err.message}`);
  }
  res.status(201).json({ ...saved.toObject(), url });
}

export async function getReportUrl(req, res) {
  const patient = await Patient.findOne(
    { patientId: req.params.patientId },
    "reports"
  ).lean();
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

  patient.reports = patient.reports.filter((r) => r._id.toString() !== req.params.reportId);
  await patient.save();
  res.json({ message: "Report deleted" });
}
