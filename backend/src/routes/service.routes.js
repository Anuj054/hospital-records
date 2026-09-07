import { Router } from "express";
import {
  createService,
  listServices,
  updateService,
  deleteService,
  bulkImportServices,
} from "../controllers/serviceController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { uploadCsv } from "../middleware/uploadCsv.js";

const router = Router();
router.use(requireAuth, requireRole("admin", "staff"));

/**
 * @openapi
 * components:
 *   schemas:
 *     Service:
 *       type: object
 *       properties:
 *         name: { type: string }
 *         category: { type: string, enum: [operation, consultation, lab, other] }
 *         defaultPrice: { type: number }
 *         gstPercent: { type: number, description: "GST rate applied when this service is billed" }
 *
 * /api/services:
 *   post:
 *     summary: Add a service to the catalog (admin only)
 *     tags: [Services]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/Service' }
 *     responses:
 *       201: { description: Service created }
 *   get:
 *     summary: List/search services
 *     tags: [Services]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *     responses:
 *       200: { description: List of services }
 */
router.post("/", requireRole("admin"), createService);
router.get("/", listServices);

/**
 * @openapi
 * /api/services/bulk:
 *   post:
 *     summary: "Bulk import services from a CSV file (admin only). Columns: name, category, defaultPrice, gstPercent"
 *     tags: [Services]
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
router.post("/bulk", requireRole("admin"), uploadCsv.single("file"), bulkImportServices);

/**
 * @openapi
 * /api/services/{id}:
 *   put:
 *     summary: Update a service (admin only)
 *     tags: [Services]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Service updated }
 *       404: { description: Service not found }
 *   delete:
 *     summary: Delete a service (admin only)
 *     tags: [Services]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Service deleted }
 *       404: { description: Service not found }
 */
router.put("/:id", requireRole("admin"), updateService);
router.delete("/:id", requireRole("admin"), deleteService);

export default router;
