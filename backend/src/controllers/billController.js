import Patient from "../models/Patient.js";
import Bill from "../models/Bill.js";
import { generateBillNumber } from "../utils/generateBillNumber.js";

// unitPrice is GST-INCLUSIVE (e.g. MRP-style pricing) — GST is backed out
// of amount rather than added on top, so amount never changes with gstPercent.
function normalizeItem(item) {
  const quantity = Number(item.quantity) || 1;
  const unitPrice = Number(item.unitPrice) || 0;
  const gstPercent = Math.min(Math.max(Number(item.gstPercent) || 0, 0), 100);
  const amount = quantity * unitPrice;
  const gstAmount = Math.round((amount * gstPercent * 100) / (100 + gstPercent)) / 100;
  return {
    refId: item.refId || undefined,
    name: item.name,
    quantity,
    unitPrice,
    amount,
    gstPercent,
    gstAmount,
  };
}

function recomputeTotals(bill) {
  bill.totalAmount = bill.items.reduce((sum, i) => sum + i.amount, 0); // inclusive, what's charged
  bill.gstAmount = bill.items.reduce((sum, i) => sum + i.gstAmount, 0); // backed out of totalAmount
  bill.subtotal = bill.totalAmount - bill.gstAmount; // taxable value
}

// Mirrors the Bill schema's virtuals for plain .lean() objects (which skip
// Mongoose document hydration — cheaper for read-only responses, but that
// means no getters, so we attach the same computed fields by hand).
function withComputed(bill) {
  const paidAmount = bill.payments.reduce((sum, p) => sum + p.amount, 0);
  const balance = Math.max(bill.totalAmount - paidAmount, 0);
  const status = bill.mergedInto
    ? "merged"
    : !bill.isFinalized
    ? "draft"
    : paidAmount <= 0
    ? "pending"
    : paidAmount >= bill.totalAmount
    ? "paid"
    : "partial";
  return { ...bill, id: bill._id, paidAmount, balance, status };
}

// Get the patient's current open draft, or null.
export async function getDraftBill(req, res) {
  const bill = await Bill.findOne({ patientId: req.params.patientId, isFinalized: false }).lean();
  res.json(bill ? withComputed(bill) : null);
}

// Add items to the patient's current draft, creating one if none exists yet.
// This is how multiple additions across a visit/stay end up on one invoice
// instead of a new bill per addition.
export async function addItemsToDraft(req, res) {
  const { items, notes, doctorName } = req.body;
  const patient = await Patient.findOne({ patientId: req.params.patientId });
  if (!patient) return res.status(404).json({ message: "Patient not found" });

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: "items must be a non-empty array" });
  }

  let bill = await Bill.findOne({ patientId: patient.patientId, isFinalized: false });
  if (!bill) {
    bill = new Bill({ patient: patient._id, patientId: patient.patientId, items: [] });
  }

  bill.items.push(...items.map(normalizeItem));
  recomputeTotals(bill);
  if (doctorName) bill.doctorName = doctorName;
  if (notes) bill.notes = notes;

  await bill.save();
  res.status(201).json(bill);
}

// Assigns an invoice number and locks the draft so it becomes the final,
// printable/payable bill. A new draft starts fresh after this.
export async function finalizeBill(req, res) {
  const bill = await Bill.findById(req.params.billId);
  if (!bill) return res.status(404).json({ message: "Bill not found" });
  if (bill.isFinalized) return res.status(400).json({ message: "Bill is already finalized" });
  if (bill.items.length === 0) {
    return res.status(400).json({ message: "Cannot finalize a bill with no items" });
  }

  bill.billNumber = await generateBillNumber();
  bill.isFinalized = true;
  bill.finalizedAt = new Date();
  await bill.save();

  res.json(bill);
}

export async function listBillsForPatient(req, res) {
  const bills = await Bill.find({ patientId: req.params.patientId }).sort({ date: -1 }).lean();
  res.json(bills.map(withComputed));
}

export async function getBill(req, res) {
  const bill = await Bill.findById(req.params.billId).lean();
  if (!bill) return res.status(404).json({ message: "Bill not found" });
  res.json(withComputed(bill));
}

export async function deleteBill(req, res) {
  const bill = await Bill.findByIdAndDelete(req.params.billId);
  if (!bill) return res.status(404).json({ message: "Bill not found" });
  res.json({ message: "Bill deleted" });
}

// Combines several already-finalized bills for the same patient into one new
// draft. Originals are kept (not deleted) and flagged mergedInto for audit —
// their items and any recorded payments carry over to the new bill.
export async function mergeBills(req, res) {
  const { billIds } = req.body;
  if (!Array.isArray(billIds) || billIds.length < 2) {
    return res.status(400).json({ message: "Select at least 2 bills to combine" });
  }

  const bills = await Bill.find({ _id: { $in: billIds } });
  if (bills.length !== billIds.length) {
    return res.status(404).json({ message: "One or more bills not found" });
  }

  const patientId = bills[0].patientId;
  if (bills.some((b) => b.patientId !== patientId)) {
    return res.status(400).json({ message: "All selected bills must belong to the same patient" });
  }
  if (bills.some((b) => !b.isFinalized)) {
    return res.status(400).json({ message: "Only finalized bills can be combined" });
  }
  if (bills.some((b) => b.mergedInto)) {
    return res.status(400).json({ message: "One or more selected bills were already merged elsewhere" });
  }

  const existingDraft = await Bill.findOne({ patientId, isFinalized: false });
  if (existingDraft) {
    return res.status(400).json({
      message: "This patient already has an open draft bill — finalize or clear it before combining",
    });
  }

  const combined = new Bill({
    patient: bills[0].patient,
    patientId,
    items: bills.flatMap((b) => b.items),
    payments: bills.flatMap((b) => b.payments),
    notes: `Combined from ${bills.map((b) => b.billNumber).join(", ")}`,
  });
  recomputeTotals(combined);
  await combined.save();

  await Bill.updateMany({ _id: { $in: billIds } }, { $set: { mergedInto: combined._id } });

  res.status(201).json(combined);
}

export async function addPayment(req, res) {
  const bill = await Bill.findById(req.params.billId);
  if (!bill) return res.status(404).json({ message: "Bill not found" });
  if (!bill.isFinalized) {
    return res.status(400).json({ message: "Finalize the bill before recording payments" });
  }

  const amount = Number(req.body.amount);
  if (!amount || amount <= 0) {
    return res.status(400).json({ message: "amount must be a positive number" });
  }
  if (amount > bill.balance) {
    return res.status(400).json({ message: `Amount exceeds remaining balance of ${bill.balance}` });
  }

  const method = req.body.method?.toLowerCase();
  bill.payments.push({ amount, method, note: req.body.note });
  await bill.save();

  res.status(201).json(bill);
}
