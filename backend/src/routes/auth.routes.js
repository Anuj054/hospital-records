import { Router } from "express";
import { login, logout, me } from "../controllers/authController.js";
import { requireAuth } from "../middleware/auth.js";
import { checkLoginRateLimit } from "../middleware/loginRateLimit.js";

const router = Router();

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     summary: Admin login
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, password]
 *             properties:
 *               username: { type: string }
 *               password: { type: string }
 *     responses:
 *       200: { description: Logged in, sets httpOnly cookie }
 *       401: { description: Invalid credentials }
 *       429: { description: "Too many failed attempts; see Retry-After" }
 */
router.post("/login", checkLoginRateLimit, login);

/**
 * @openapi
 * /api/auth/logout:
 *   post:
 *     summary: Admin logout
 *     tags: [Auth]
 *     responses:
 *       200: { description: Logged out }
 */
router.post("/logout", logout);

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     summary: Get current logged-in admin
 *     tags: [Auth]
 *     responses:
 *       200: { description: Current admin }
 *       401: { description: Not authenticated }
 */
router.get("/me", requireAuth, me);

export default router;
