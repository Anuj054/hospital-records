import { Router } from "express";
import {
  listStaff,
  createStaff,
  resetStaffPassword,
  deleteStaff,
} from "../controllers/staffController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth, requireRole("admin"));

/**
 * @openapi
 * /api/staff:
 *   get:
 *     summary: List staff accounts (admin only)
 *     tags: [Staff]
 *     responses:
 *       200: { description: List of staff }
 *   post:
 *     summary: Create a staff account (admin only)
 *     tags: [Staff]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, password]
 *             properties:
 *               username: { type: string }
 *               password: { type: string, minLength: 6 }
 *     responses:
 *       201: { description: Staff created }
 */
router.get("/", listStaff);
router.post("/", createStaff);

/**
 * @openapi
 * /api/staff/{id}/password:
 *   put:
 *     summary: Reset a staff member's password (admin only)
 *     tags: [Staff]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [password]
 *             properties:
 *               password: { type: string, minLength: 6 }
 *     responses:
 *       200: { description: Password updated }
 *       404: { description: Staff not found }
 */
router.put("/:id/password", resetStaffPassword);

/**
 * @openapi
 * /api/staff/{id}:
 *   delete:
 *     summary: Remove a staff account (admin only)
 *     tags: [Staff]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Staff removed }
 *       404: { description: Staff not found }
 */
router.delete("/:id", deleteStaff);

export default router;
