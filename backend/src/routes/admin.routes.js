import { Router } from "express";
import {
  getBackup,
  deletePatientEverywhere,
  listDeletions,
} from "../controllers/adminController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();
// Every route here is admin-only: backups contain the whole database and
// the delete is irreversible.
router.use(requireAuth, requireRole("admin"));

/**
 * @openapi
 * /api/admin/backup:
 *   get:
 *     summary: Download a backup of the database (admin only)
 *     description: >
 *       Returns every collection as JSON plus a 1-hour Supabase signed URL for
 *       each report file. Report files are not inlined - the client fetches
 *       them and builds the archive, because serverless responses are capped
 *       at about 4.5MB. Staff password hashes are excluded.
 *     tags: [Admin]
 *     parameters:
 *       - in: query
 *         name: patientId
 *         schema: { type: string }
 *         description: Back up a single patient instead of the whole database
 *     responses:
 *       200: { description: Backup payload }
 *       403: { description: Admin only }
 *       404: { description: Patient not found }
 */
router.get("/backup", getBackup);

/**
 * @openapi
 * /api/admin/deletions:
 *   get:
 *     summary: Audit trail of purged patient records (admin only)
 *     tags: [Admin]
 *     responses:
 *       200: { description: Most recent 100 deletions }
 */
router.get("/deletions", listDeletions);

/**
 * @openapi
 * /api/admin/patients/{patientId}:
 *   delete:
 *     summary: Permanently delete a patient from Mongo and Supabase (admin only)
 *     description: >
 *       Irreversible. Removes the patient, all their bills, and all their
 *       uploaded report files. Back up first - there is no undo.
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [confirm]
 *             properties:
 *               confirm:
 *                 type: string
 *                 description: Must exactly match the patient ID
 *               backupConfirmed:
 *                 type: boolean
 *                 description: Recorded in the audit trail
 *     responses:
 *       200: { description: Deleted, with counts of what was removed }
 *       400: { description: Confirmation did not match the patient ID }
 *       403: { description: Admin only }
 *       404: { description: Patient not found }
 */
router.delete("/patients/:patientId", deletePatientEverywhere);

export default router;
