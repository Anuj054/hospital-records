import { Router } from "express";
import { getStats } from "../controllers/dashboardController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

/**
 * @openapi
 * /api/dashboard/stats:
 *   get:
 *     summary: Get today's collection/registration stats for the dashboard
 *     tags: [Dashboard]
 *     responses:
 *       200: { description: Stats object }
 */
router.get("/stats", requireAuth, getStats);

export default router;
