import { Router } from "express";
import {
  getDraftBill,
  saveDraftBill,
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
 *         quantity: { type: number, description: "Days, for the Room Charges line" }
 *         unitPrice: { type: number }
 *         category: { type: string, description: "Which pre-printed line of the bill pad this charge sits on; defaults to misc" }
 *         remarks: { type: string, description: "Free text for the pad's REMARKS column" }
 *     Bill:
 *       type: object
 *       properties:
 *         billNumber: { type: string, example: "INV-2026-0001", description: "Only set once finalized" }
 *         patientId: { type: string }
 *         items:
 *           type: array
 *           items: { $ref: '#/components/schemas/BillItem' }
 *         totalAmount: { type: number, description: "Sum of item amounts" }
 *         admission:
 *           type: object
 *           description: "The pad's D.O.A. / D.O.D. / Time of Admission / T.O.D. block"
 *           properties:
 *             dateOfAdmission: { type: string, format: date }
 *             dateOfDischarge: { type: string, format: date }
 *             timeOfAdmission: { type: string, example: "10:30 AM" }
 *             timeOfDischarge: { type: string, example: "4:15 PM" }
 *         receivedFrom: { type: string, description: "The pad's \"Received with thanks from\" line" }
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
 *     summary: "Save the patient's open draft (creates one if none exists). Sends the whole bill sheet: items REPLACE what was there, they do not accumulate."
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
 *               notes: { type: string }
 *     responses:
 *       201: { description: Updated draft bill }
 *       404: { description: Patient not found }
 */
router.get("/patients/:patientId/bills/draft", getDraftBill);
router.post("/patients/:patientId/bills/draft", saveDraftBill);

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
