import crypto from "crypto";
import Patient from "../models/Patient.js";
import Bill from "../models/Bill.js";
import { getReportSignedUrl } from "../utils/reportsStorage.js";

const SHARE_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function generateShareLink(req, res) {
  const patient = await Patient.findOne({ patientId: req.params.patientId });
  if (!patient) return res.status(404).json({ message: "Patient not found" });

  patient.shareToken = crypto.randomBytes(24).toString("hex");
  patient.shareTokenExpiresAt = new Date(Date.now() + SHARE_LINK_TTL_MS);
  await patient.save();

  res.status(201).json({
    token: patient.shareToken,
    expiresAt: patient.shareTokenExpiresAt,
  });
}

export async function revokeShareLink(req, res) {
  const patient = await Patient.findOne({ patientId: req.params.patientId });
  if (!patient) return res.status(404).json({ message: "Patient not found" });

  patient.shareToken = undefined;
  patient.shareTokenExpiresAt = undefined;
  await patient.save();

  res.json({ message: "Share link revoked" });
}

export async function getShareStatus(req, res) {
  const patient = await Patient.findOne({ patientId: req.params.patientId });
  if (!patient) return res.status(404).json({ message: "Patient not found" });

  const active = !!patient.shareToken && patient.shareTokenExpiresAt > new Date();
  res.json({
    active,
    token: active ? patient.shareToken : null,
    expiresAt: active ? patient.shareTokenExpiresAt : null,
  });
}

async function findActivePatientByToken(token) {
  const patient = await Patient.findOne({ shareToken: token });
  if (!patient) return null;
  if (!patient.shareTokenExpiresAt || patient.shareTokenExpiresAt <= new Date()) return null;
  return patient;
}

export async function getSharedPatientData(req, res) {
  const patient = await findActivePatientByToken(req.params.token);
  if (!patient) return res.status(404).json({ message: "Link not found or expired" });

  const bills = await Bill.find({ patientId: patient.patientId, isFinalized: true }).sort({
    date: -1,
  });

  res.json({
    patient: {
      patientId: patient.patientId,
      name: patient.name,
      age: patient.age,
      gender: patient.gender,
      reports: patient.reports.map((r) => ({
        _id: r._id,
        category: r.category,
        originalName: r.originalName,
        uploadedAt: r.uploadedAt,
      })),
    },
    bills,
    expiresAt: patient.shareTokenExpiresAt,
  });
}

export async function getSharedReportUrl(req, res) {
  const patient = await findActivePatientByToken(req.params.token);
  if (!patient) return res.status(404).json({ message: "Link not found or expired" });

  const report = patient.reports.find((r) => r._id.toString() === req.params.reportId);
  if (!report) return res.status(404).json({ message: "Report not found" });

  const url = await getReportSignedUrl(report.storedPath);
  res.json({ url });
}
