import Patient from "../models/Patient.js";
import Bill from "../models/Bill.js";
import Medicine from "../models/Medicine.js";
import Service from "../models/Service.js";
import Doctor from "../models/Doctor.js";
import Staff from "../models/Staff.js";
import Counter from "../models/Counter.js";
import DeletionLog from "../models/DeletionLog.js";
import {
  getReportSignedUrls,
  deleteReportFiles,
  listPatientReportFiles,
} from "../utils/reportsStorage.js";

// Hobby functions cap responses at roughly 4.5MB, so the backup deliberately
// carries only database rows plus a signed URL per report file. The browser
// downloads the files itself and assembles the archive (see
// frontend/src/pages/AdminData.jsx) — that keeps arbitrarily large x-rays
// out of the function response entirely.
export async function getBackup(req, res) {
  const { patientId } = req.query;

  const patientFilter = patientId ? { patientId } : {};
  const patients = await Patient.find(patientFilter).lean();

  if (patientId && patients.length === 0) {
    return res.status(404).json({ message: "Patient not found" });
  }

  const billFilter = patientId ? { patientId } : {};

  const [bills, medicines, services, doctors, staff, counters, deletions] = await Promise.all([
    Bill.find(billFilter).lean(),
    // Catalog and reference data go in whole-database backups only; they
    // aren't part of one patient's record.
    patientId ? [] : Medicine.find().lean(),
    patientId ? [] : Service.find().lean(),
    patientId ? [] : Doctor.find().lean(),
    // Deliberately excludes passwordHash. A backup lands on a laptop or in
    // cloud storage, and bcrypt hashes of staff passwords do not belong
    // there; staff logins can simply be recreated after a restore.
    patientId ? [] : Staff.find({}, "username createdAt updatedAt").lean(),
    // Needed for a restore, otherwise the next patient/invoice would reuse
    // an ID that already exists in the restored data.
    patientId ? [] : Counter.find().lean(),
    patientId ? [] : DeletionLog.find().lean(),
  ]);

  // One Supabase call for every report across every patient in scope.
  const allPaths = patients.flatMap((p) => p.reports.map((r) => r.storedPath));
  let signedUrls = {};
  try {
    signedUrls = await getReportSignedUrls(allPaths);
  } catch (err) {
    console.error(`Backup could not sign report URLs: ${err.message}`);
  }

  const reportFiles = patients.flatMap((p) =>
    p.reports.map((r) => ({
      patientId: p.patientId,
      reportId: String(r._id),
      category: r.category,
      originalName: r.originalName,
      storedPath: r.storedPath,
      uploadedAt: r.uploadedAt,
      url: signedUrls[r.storedPath] || null,
    }))
  );

  const unsigned = reportFiles.filter((f) => !f.url).length;

  res.json({
    generatedAt: new Date().toISOString(),
    generatedBy: req.user.username,
    scope: patientId ? `patient:${patientId}` : "full-database",
    notes: [
      "Staff password hashes are intentionally excluded.",
      "Report URLs are Supabase signed links valid for 1 hour from generatedAt.",
    ],
    counts: {
      patients: patients.length,
      bills: bills.length,
      medicines: medicines.length,
      services: services.length,
      doctors: doctors.length,
      staff: staff.length,
      reportFiles: reportFiles.length,
      reportFilesUnsigned: unsigned,
    },
    collections: {
      patients,
      bills,
      medicines,
      services,
      doctors,
      staff,
      counters,
      deletionLog: deletions,
    },
    reportFiles,
  });
}

// Irreversibly removes one patient from Mongo and Supabase. Requires the
// caller to echo the patient ID back, so a stray click or a replayed
// request can't destroy a record.
export async function deletePatientEverywhere(req, res) {
  const { patientId } = req.params;
  const { confirm, backupConfirmed } = req.body || {};

  if (confirm !== patientId) {
    return res.status(400).json({
      message: `To delete this record, send "confirm" exactly matching the patient ID (${patientId}).`,
    });
  }

  const patient = await Patient.findOne({ patientId }).lean();
  if (!patient) return res.status(404).json({ message: "Patient not found" });

  // Storage goes first. If Mongo then fails we're left with a record whose
  // files are gone — visible and retryable — rather than files nobody can
  // see or account for still sitting in the bucket.
  const recorded = patient.reports.map((r) => r.storedPath);
  let discovered = [];
  try {
    discovered = await listPatientReportFiles(patientId);
  } catch (err) {
    console.error(`Could not list storage for ${patientId}: ${err.message}`);
  }
  const paths = [...new Set([...recorded, ...discovered])];

  let filesDeleted = 0;
  if (paths.length) filesDeleted = await deleteReportFiles(paths);

  const { deletedCount: billsDeleted } = await Bill.deleteMany({ patientId });
  await Patient.deleteOne({ _id: patient._id });

  await DeletionLog.create({
    patientId,
    patientName: patient.name,
    deletedBy: req.user.username,
    billsDeleted,
    filesDeleted,
    backupConfirmed: !!backupConfirmed,
  });

  res.json({
    message: `Deleted ${patientId} from the database and file storage`,
    patientId,
    billsDeleted,
    filesDeleted,
  });
}

export async function listDeletions(req, res) {
  const deletions = await DeletionLog.find().sort({ deletedAt: -1 }).limit(100).lean();
  res.json(deletions);
}
