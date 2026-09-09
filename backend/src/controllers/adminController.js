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

// One archive-and-purge run handles at most this many patients. It keeps the
// JSON response clear of the ~4.5MB serverless cap and the whole operation
// inside the function time limit; the UI just says to run it again for the
// remainder.
const MAX_BATCH = 100;

// "Old" has to mean last activity, not registration date. Filtering on
// createdAt would purge someone who registered three months ago and is
// currently admitted with an open bill. lastActivityAt is the latest of:
// registration, any edit to the record, the most recent bill, and the most
// recent report upload.
function purgeCandidatePipeline(before) {
  return [
    {
      $lookup: {
        from: "bills",
        localField: "patientId",
        foreignField: "patientId",
        as: "bills",
      },
    },
    {
      $addFields: {
        lastBillAt: {
          $max: {
            $map: {
              input: "$bills",
              as: "b",
              in: { $ifNull: ["$$b.finalizedAt", "$$b.date"] },
            },
          },
        },
        lastReportAt: { $max: "$reports.uploadedAt" },
        billCount: { $size: "$bills" },
        reportCount: { $size: "$reports" },
        draftCount: {
          $size: {
            $filter: { input: "$bills", as: "b", cond: { $eq: ["$$b.isFinalized", false] } },
          },
        },
        // Money still owed, counting only real invoices (finalized, not
        // folded into a combined bill).
        outstanding: {
          $sum: {
            $map: {
              input: {
                $filter: {
                  input: "$bills",
                  as: "b",
                  cond: {
                    $and: [
                      { $eq: ["$$b.isFinalized", true] },
                      { $eq: ["$$b.mergedInto", null] },
                    ],
                  },
                },
              },
              as: "b",
              in: {
                $max: [
                  { $subtract: ["$$b.totalAmount", { $sum: "$$b.payments.amount" }] },
                  0,
                ],
              },
            },
          },
        },
      },
    },
    // $max ignores nulls, so patients with no bills or no reports still get a
    // sensible date from createdAt/updatedAt.
    {
      $addFields: {
        lastActivityAt: { $max: ["$createdAt", "$updatedAt", "$lastBillAt", "$lastReportAt"] },
      },
    },
    { $match: { lastActivityAt: { $lt: before } } },
    {
      $project: {
        patientId: 1,
        name: 1,
        lastActivityAt: 1,
        billCount: 1,
        reportCount: 1,
        draftCount: 1,
        outstanding: { $round: ["$outstanding", 2] },
      },
    },
    { $sort: { lastActivityAt: 1 } }, // oldest first
  ];
}

function parseBefore(value) {
  const before = new Date(value);
  if (Number.isNaN(before.getTime())) return null;
  return before;
}

// What an archive-and-purge for this cutoff would cover, so the admin can
// see it before anything is written or removed.
export async function getPurgePreview(req, res) {
  const before = parseBefore(req.query.before);
  if (!before) {
    return res.status(400).json({ message: "before must be a valid date" });
  }

  const candidates = await Patient.aggregate(purgeCandidatePipeline(before));

  // Anyone who still owes money, or has a bill mid-edit, is held back by
  // default — purging them would destroy the record of the debt.
  const withDebt = candidates.filter((c) => c.outstanding > 0 || c.draftCount > 0);
  const clear = candidates.filter((c) => c.outstanding <= 0 && c.draftCount === 0);

  res.json({
    before: before.toISOString(),
    maxBatch: MAX_BATCH,
    eligible: clear.slice(0, MAX_BATCH),
    eligibleTotal: clear.length,
    heldBack: withDebt,
    totals: {
      patients: clear.length,
      bills: clear.reduce((s, c) => s + c.billCount, 0),
      reportFiles: clear.reduce((s, c) => s + c.reportCount, 0),
    },
  });
}

// Hobby functions cap responses at roughly 4.5MB, so the backup deliberately
// carries only database rows plus a signed URL per report file. The browser
// downloads the files itself and assembles the archive (see
// frontend/src/pages/AdminData.jsx) — that keeps arbitrarily large x-rays
// out of the function response entirely.
export async function getBackup(req, res) {
  const { patientId, before, includeUnpaid } = req.query;

  let patientFilter = {};
  let scopedIds = null;

  if (patientId) {
    patientFilter = { patientId };
  } else if (before) {
    // Archive mode: back up exactly the patients this cutoff covers. The
    // response reports which patients it actually contains, and the client
    // purges that list rather than re-running the query — otherwise a bill
    // added between the two calls could change the set and delete someone
    // who was never in the archive.
    const cutoff = parseBefore(before);
    if (!cutoff) return res.status(400).json({ message: "before must be a valid date" });

    let candidates = await Patient.aggregate(purgeCandidatePipeline(cutoff));
    if (includeUnpaid !== "true") {
      candidates = candidates.filter((c) => c.outstanding <= 0 && c.draftCount === 0);
    }
    scopedIds = candidates.slice(0, MAX_BATCH).map((c) => c.patientId);
    patientFilter = { patientId: { $in: scopedIds } };
  }

  const patients = await Patient.find(patientFilter).lean();

  if (patientId && patients.length === 0) {
    return res.status(404).json({ message: "Patient not found" });
  }

  const scoped = patientId || scopedIds;
  const billFilter = patientId
    ? { patientId }
    : scopedIds
    ? { patientId: { $in: scopedIds } }
    : {};

  const [bills, medicines, services, doctors, staff, counters, deletions] = await Promise.all([
    Bill.find(billFilter).lean(),
    // Catalog and reference data go in whole-database backups only; they
    // aren't part of a particular patient's record. Included in archive runs
    // too, so an archive is restorable on its own.
    scoped && patientId ? [] : Medicine.find().lean(),
    scoped && patientId ? [] : Service.find().lean(),
    scoped && patientId ? [] : Doctor.find().lean(),
    // Deliberately excludes passwordHash. A backup lands on a laptop or in
    // cloud storage, and bcrypt hashes of staff passwords do not belong
    // there; staff logins can simply be recreated after a restore.
    scoped && patientId ? [] : Staff.find({}, "username createdAt updatedAt").lean(),
    // Needed for a restore, otherwise the next patient/invoice would reuse
    // an ID that already exists in the restored data.
    scoped && patientId ? [] : Counter.find().lean(),
    scoped && patientId ? [] : DeletionLog.find().lean(),
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
    scope: patientId
      ? `patient:${patientId}`
      : scopedIds
      ? `archive:before-${before}`
      : "full-database",
    // The authoritative list of who this archive covers. The purge that
    // follows must use exactly this, not a fresh query.
    patientIds: patients.map((p) => p.patientId),
    truncatedToBatchLimit: !!(scopedIds && scopedIds.length >= MAX_BATCH),
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
