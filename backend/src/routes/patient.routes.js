import { Router } from "express";
import {
  createPatient,
  listPatients,
  getPatient,
  updatePatient,
  uploadReport,
  getReportUrl,
  deleteReport,
} from "../controllers/patientController.js";
import {
  generateShareLink,
  revokeShareLink,
  getShareStatus,
} from "../controllers/shareController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";

const router = Router();
router.use(requireAuth, requireRole("admin", "staff"));

/**
 * @openapi
 * components:
 *   schemas:
 *     Patient:
 *       type: object
 *       properties:
 *         patientId: { type: string, example: "HR-2026-0001" }
 *         name: { type: string }
 *         age: { type: number }
 *         gender: { type: string, enum: [male, female, other] }
 *         phone: { type: string }
 *         address: { type: string }
 *         reports:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               category: { type: string, enum: [blood test, xray, scan, other] }
 *               originalName: { type: string }
 *               storedPath: { type: string }
 *               uploadedAt: { type: string, format: date-time }
 *
 * /api/patients:
 *   post:
 *     summary: Create a new patient (auto-generates unique patientId)
 *     tags: [Patients]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *               age: { type: number }
 *               gender: { type: string, enum: [male, female, other] }
 *               phone: { type: string }
 *               address: { type: string }
 *     responses:
 *       201:
 *         description: Patient created
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Patient' }
 *   get:
 *     summary: Search/list patients
 *     tags: [Patients]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *         description: Search by patientId, name, or phone
 *     responses:
 *       200: { description: List of patients }
 */
router.post("/", createPatient);
router.get("/", listPatients);

/**
 * @openapi
 * /api/patients/{patientId}:
 *   get:
 *     summary: Get a single patient by unique ID
 *     tags: [Patients]
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Patient found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Patient' }
 *       404: { description: Patient not found }
 *   put:
 *     summary: Update patient details
 *     tags: [Patients]
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Patient updated }
 *       404: { description: Patient not found }
 */
router.get("/:patientId", getPatient);
router.put("/:patientId", updatePatient);

/**
 * @openapi
 * /api/patients/{patientId}/reports:
 *   post:
 *     summary: Upload a report/x-ray file for a patient
 *     tags: [Patients]
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file: { type: string, format: binary }
 *               category: { type: string, enum: [blood test, xray, scan, other] }
 *     responses:
 *       201: { description: Report uploaded }
 *       404: { description: Patient not found }
 */
router.post("/:patientId/reports", upload.single("file"), uploadReport);

/**
 * @openapi
 * /api/patients/{patientId}/reports/{reportId}/url:
 *   get:
 *     summary: Get a temporary signed URL to view/download a report (bucket is private)
 *     tags: [Patients]
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: reportId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Signed URL, valid for 1 hour }
 *       404: { description: Patient or report not found }
 */
router.get("/:patientId/reports/:reportId/url", getReportUrl);

/**
 * @openapi
 * /api/patients/{patientId}/reports/{reportId}:
 *   delete:
 *     summary: Delete a report from a patient
 *     tags: [Patients]
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: reportId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Report deleted }
 *       404: { description: Patient not found }
 */
router.delete("/:patientId/reports/:reportId", deleteReport);

/**
 * @openapi
 * /api/patients/{patientId}/share:
 *   get:
 *     summary: Get current share-link status for a patient
 *     tags: [Patients]
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: "{ active, token, expiresAt }" }
 *   post:
 *     summary: Generate (or regenerate) a 7-day public share link for a patient
 *     tags: [Patients]
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       201: { description: "{ token, expiresAt }" }
 *       404: { description: Patient not found }
 *   delete:
 *     summary: Revoke the active share link for a patient
 *     tags: [Patients]
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Revoked }
 *       404: { description: Patient not found }
 */
router.get("/:patientId/share", getShareStatus);
router.post("/:patientId/share", generateShareLink);
router.delete("/:patientId/share", revokeShareLink);

export default router;
