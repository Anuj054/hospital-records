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
 *         gstNo: { type: string, description: "Hospital's GST registration number, printed on bills" }
 *         defaultGstPercent: { type: number, description: "Pre-filled GST% when creating a new bill" }
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
    gstNo: process.env.HOSPITAL_GST_NO || "",
    defaultGstPercent: Number(process.env.DEFAULT_GST_PERCENT) || 0,
  });
});

export default router;
