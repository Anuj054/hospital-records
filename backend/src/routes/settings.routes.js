import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

/**
 * @openapi
 * components:
 *   schemas:
 *     Settings:
 *       type: object
 *       properties:
 *         hospitalName: { type: string }
 *         address: { type: string }
 *         phone: { type: string }
 *         regNo: { type: string, description: "Hospital registration number, printed under the name on every bill" }
 *
 * /api/settings:
 *   get:
 *     summary: Get hospital info used on the bill template header
 *     tags: [Settings]
 *     responses:
 *       200:
 *         description: Hospital settings
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Settings' }
 */
router.get("/", requireAuth, (req, res) => {
  res.json({
    hospitalName: process.env.HOSPITAL_NAME || "Your Hospital Name",
    address: process.env.HOSPITAL_ADDRESS || "",
    phone: process.env.HOSPITAL_PHONE || "",
    regNo: process.env.HOSPITAL_REG_NO || "",
  });
});

export default router;
