import { Router } from "express";
import {
  getDraftBill,
  addItemsToDraft,
  finalizeBill,
  mergeBills,
  listBillsForPatient,
  getBill,
  deleteBill,
  addPayment,
} from "../controllers/billController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth, requireRole("admin", "staff"));

/**
 * @openapi
 * components:
 *   schemas:
 *     BillItem:
 *       type: object
 *       properties:
 *         refId: { type: string, description: "Medicine or Service _id (optional for custom items)" }
 *         name: { type: string }
 *         quantity: { type: number }
 *         unitPrice: { type: number }
 *         gstPercent: { type: number, description: "GST rate for this item, 0-100" }
 *     Bill:
 *       type: object
 *       properties:
 *         billNumber: { type: string, example: "INV-2026-0001", description: "Only set once finalized" }
 *         patientId: { type: string }
 *         doctorName: { type: string }
 *         items:
 *           type: array
 *           items: { $ref: '#/components/schemas/BillItem' }
 *         subtotal: { type: number, description: "Sum of item amounts, before GST" }
 *         gstAmount: { type: number, description: "Sum of each item's amount * gstPercent / 100" }
 *         totalAmount: { type: number, description: "subtotal + gstAmount" }
 *         payments:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               amount: { type: number }
 *               method: { type: string, enum: [cash, card, upi, other] }
 *               note: { type: string }
 *               paidAt: { type: string, format: date-time }
 *         paidAmount: { type: number, description: "Computed: sum of payments" }
 *         balance: { type: number, description: "Computed: totalAmount - paidAmount" }
 *         isFinalized: { type: boolean }
 *         status: { type: string, enum: [draft, pending, partial, paid], description: "Computed" }
 *         notes: { type: string }
 *         date: { type: string, format: date-time }
 *
 * /api/patients/{patientId}/bills/draft:
 *   get:
 *     summary: Get the patient's current open draft bill, if any
 *     tags: [Bills]
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Draft bill, or null if none open }
 *   post:
 *     summary: Add items to the patient's current draft (creates one if none exists). Repeated calls accumulate onto the same bill instead of creating new invoices.
 *     tags: [Bills]
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [items]
 *             properties:
 *               items:
 *                 type: array
 *                 items: { $ref: '#/components/schemas/BillItem' }
 *               doctorName: { type: string }
 *               notes: { type: string }
 *     responses:
 *       201: { description: Updated draft bill }
 *       404: { description: Patient not found }
 */
router.get("/patients/:patientId/bills/draft", getDraftBill);
router.post("/patients/:patientId/bills/draft", addItemsToDraft);

/**
 * @openapi
 * /api/patients/{patientId}/bills:
 *   get:
 *     summary: List all bills for a patient (drafts and finalized)
 *     tags: [Bills]
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: List of bills }
 */
router.get("/patients/:patientId/bills", listBillsForPatient);

/**
 * @openapi
 * /api/bills/{billId}:
 *   get:
 *     summary: Get a single bill by ID
 *     tags: [Bills]
 *     parameters:
 *       - in: path
 *         name: billId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Bill found }
 *       404: { description: Bill not found }
 *   delete:
 *     summary: Delete a bill (admin only)
 *     tags: [Bills]
 *     parameters:
 *       - in: path
 *         name: billId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Bill deleted }
 *       404: { description: Bill not found }
 */
router.get("/bills/:billId", getBill);
router.delete("/bills/:billId", requireRole("admin"), deleteBill);

/**
 * @openapi
 * /api/bills/{billId}/finalize:
 *   post:
 *     summary: Finalize a draft bill — assigns an invoice number and locks it (no more items can be added)
 *     tags: [Bills]
 *     parameters:
 *       - in: path
 *         name: billId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Finalized bill }
 *       400: { description: Already finalized, or has no items }
 *       404: { description: Bill not found }
 */
router.post("/bills/:billId/finalize", finalizeBill);

/**
 * @openapi
 * /api/bills/merge:
 *   post:
 *     summary: Combine several finalized bills for the same patient into one new draft. Originals are kept and flagged mergedInto for audit; their items and any recorded payments carry over.
 *     tags: [Bills]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [billIds]
 *             properties:
 *               billIds:
 *                 type: array
 *                 items: { type: string }
 *     responses:
 *       201: { description: New combined draft bill }
 *       400: { description: Invalid selection (different patients, unfinalized, already merged, or an open draft already exists) }
 *       404: { description: One or more bills not found }
 */
router.post("/bills/merge", mergeBills);

/**
 * @openapi
 * /api/bills/{billId}/payments:
 *   post:
 *     summary: Record a payment against a finalized bill
 *     tags: [Bills]
 *     parameters:
 *       - in: path
 *         name: billId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount]
 *             properties:
 *               amount: { type: number }
 *               method: { type: string, enum: [cash, card, upi, other] }
 *               note: { type: string }
 *     responses:
 *       201: { description: Payment recorded, returns updated bill }
 *       400: { description: Invalid amount, exceeds balance, or bill not finalized yet }
 *       404: { description: Bill not found }
 */
router.post("/bills/:billId/payments", addPayment);

export default router;
