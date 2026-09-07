import { Router } from "express";
import { getSharedPatientData, getSharedReportUrl } from "../controllers/shareController.js";

const router = Router();

/**
 * @openapi
 * /api/public/share/{token}:
 *   get:
 *     summary: Get a patient's bills/reports via a public share link (no login required)
 *     tags: [Public]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: "{ patient, bills, expiresAt }" }
 *       404: { description: Link not found or expired }
 */
router.get("/share/:token", getSharedPatientData);

/**
 * @openapi
 * /api/public/share/{token}/reports/{reportId}/url:
 *   get:
 *     summary: Get a signed URL for a report via a public share link
 *     tags: [Public]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: reportId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: "{ url }" }
 *       404: { description: Link not found, expired, or report not found }
 */
router.get("/share/:token/reports/:reportId/url", getSharedReportUrl);

export default router;
