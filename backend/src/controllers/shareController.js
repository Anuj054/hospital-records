import crypto from "crypto";
import Patient from "../models/Patient.js";
import Bill from "../models/Bill.js";
import { getReportSignedUrl, getReportSignedUrls } from "../utils/reportsStorage.js";
import { withComputed } from "../utils/billComputed.js";

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
  const patient = await Patient.findOne(
    { patientId: req.params.patientId },
    "shareToken shareTokenExpiresAt"
  ).lean();
  if (!patient) return res.status(404).json({ message: "Patient not found" });

  const active = !!patient.shareToken && patient.shareTokenExpiresAt > new Date();
  res.json({
    active,
    token: active ? patient.shareToken : null,
    expiresAt: active ? patient.shareTokenExpiresAt : null,
  });
}

async function findActivePatientByToken(token) {
  // Expiry is part of the query so an expired link never loads the record.
  const patient = await Patient.findOne({
    shareToken: token,
    shareTokenExpiresAt: { $gt: new Date() },
  }).lean();
  return patient || null;
}

export async function getSharedPatientData(req, res) {
  const patient = await findActivePatientByToken(req.params.token);
  if (!patient) return res.status(404).json({ message: "Link not found or expired" });

  const bills = await Bill.find({
    patientId: patient.patientId,
    isFinalized: true,
    // Bills that were folded into a combined invoice must not be shown: the
    // patient would see both the originals and the combined bill and think
    // they owe the sum of both.
    mergedInto: null,
  })
    .sort({ date: -1 })
    .lean();

  // Signed in one Supabase call and returned with the payload, so the share
  // page renders every report from a single request instead of firing one
  // request per report after mount.
  const reportUrls = await getReportSignedUrls(patient.reports.map((r) => r.storedPath));

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
        url: reportUrls[r.storedPath] || null,
      })),
    },
    bills: bills.map(withComputed),
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
