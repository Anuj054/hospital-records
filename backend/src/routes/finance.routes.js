import { Router } from "express";
import { getFinanceSummary } from "../controllers/financeController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

/**
 * @openapi
 * /api/finance/summary:
 *   get:
 *     summary: Financial summary (admin only) — collections, outstanding balance, breakdown by method/status, 14-day revenue series
 *     tags: [Finance]
 *     responses:
 *       200: { description: Finance summary object }
 *       403: { description: Not authorized (admin only) }
 */
router.get("/summary", requireAuth, requireRole("admin"), getFinanceSummary);

export default router;
