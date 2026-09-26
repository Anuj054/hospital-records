import { Router } from "express";
import {
  createMedicine,
  listMedicines,
  updateMedicine,
  deleteMedicine,
  bulkImportMedicines,
} from "../controllers/medicineController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { uploadCsv } from "../middleware/uploadCsv.js";

const router = Router();
router.use(requireAuth, requireRole("admin", "staff"));

/**
 * @openapi
 * components:
 *   schemas:
 *     Medicine:
 *       type: object
 *       properties:
 *         name: { type: string }
 *         unit: { type: string, example: "tablet" }
 *         defaultPrice: { type: number }
 *
 * /api/medicines:
 *   post:
 *     summary: Add a medicine to the catalog (admin only)
 *     tags: [Medicines]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/Medicine' }
 *     responses:
 *       201: { description: Medicine created }
 *   get:
 *     summary: List/search medicines
 *     tags: [Medicines]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *     responses:
 *       200: { description: List of medicines }
 */
router.post("/", requireRole("admin"), createMedicine);
router.get("/", listMedicines);

/**
 * @openapi
 * /api/medicines/bulk:
 *   post:
 *     summary: "Bulk import medicines from a CSV file (admin only). Columns: name, unit, defaultPrice"
 *     tags: [Medicines]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file: { type: string, format: binary }
 *     responses:
 *       201: { description: "{ insertedCount, skippedCount, skipped }" }
 */
router.post("/bulk", requireRole("admin"), uploadCsv.single("file"), bulkImportMedicines);

/**
 * @openapi
 * /api/medicines/{id}:
 *   put:
 *     summary: Update a medicine (admin only)
 *     tags: [Medicines]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Medicine updated }
 *       404: { description: Medicine not found }
 *   delete:
 *     summary: Delete a medicine (admin only)
 *     tags: [Medicines]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Medicine deleted }
 *       404: { description: Medicine not found }
 */
router.put("/:id", requireRole("admin"), updateMedicine);
router.delete("/:id", requireRole("admin"), deleteMedicine);

export default router;
