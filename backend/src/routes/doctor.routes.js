import { Router } from "express";
import {
  createDoctor,
  listDoctors,
  updateDoctor,
  deleteDoctor,
} from "../controllers/doctorController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth, requireRole("admin", "staff"));

/**
 * @openapi
 * /api/doctors:
 *   get:
 *     summary: List doctors
 *     tags: [Doctors]
 *     responses:
 *       200: { description: List of doctors }
 *   post:
 *     summary: Add a doctor (admin only)
 *     tags: [Doctors]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *               qualification: { type: string, example: "MBBS, MD" }
 *     responses:
 *       201: { description: Doctor created }
 */
router.get("/", listDoctors);
router.post("/", requireRole("admin"), createDoctor);

/**
 * @openapi
 * /api/doctors/{id}:
 *   put:
 *     summary: Update a doctor (admin only)
 *     tags: [Doctors]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Doctor updated }
 *       404: { description: Doctor not found }
 *   delete:
 *     summary: Remove a doctor (admin only)
 *     tags: [Doctors]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Doctor removed }
 *       404: { description: Doctor not found }
 */
router.put("/:id", requireRole("admin"), updateDoctor);
router.delete("/:id", requireRole("admin"), deleteDoctor);

export default router;
