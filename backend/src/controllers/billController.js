import Patient from "../models/Patient.js";
import Bill from "../models/Bill.js";
import { generateBillNumber } from "../utils/generateBillNumber.js";
import { withComputed } from "../utils/billComputed.js";
import { BILL_CATEGORY_SLUGS, DEFAULT_BILL_CATEGORY } from "../constants/billCategories.js";

const CATEGORY_SET = new Set(BILL_CATEGORY_SLUGS);

function normalizeItem(item) {
  const quantity = Number(item.quantity) || 1;
  const unitPrice = Number(item.unitPrice) || 0;
  // An unrecognised category is coerced rather than rejected so a stale
  // client can't 400 the whole bill — the charge still lands, under Misc.
  const category = CATEGORY_SET.has(item.category) ? item.category : DEFAULT_BILL_CATEGORY;
  return {
    refId: item.refId || undefined,
    category,
    name: item.name,
    quantity,
    unitPrice,
    amount: Math.round(quantity * unitPrice * 100) / 100,
    remarks: item.remarks || undefined,
  };
}

function recomputeTotals(bill) {
  const total = bill.items.reduce((sum, i) => sum + i.amount, 0);
  bill.totalAmount = Math.round(total * 100) / 100;
}

// The pad's header block. Blank strings clear a field rather than being
// stored, so clearing a date in the form actually empties it on the bill.
function applyBillHeader(bill, body) {
  if (body.notes !== undefined) bill.notes = body.notes;
  if (body.receivedFrom !== undefined) bill.receivedFrom = body.receivedFrom;
  if (body.admission) {
    const a = body.admission;
    bill.admission = {
      dateOfAdmission: a.dateOfAdmission ? new Date(a.dateOfAdmission) : undefined,
      dateOfDischarge: a.dateOfDischarge ? new Date(a.dateOfDischarge) : undefined,
      timeOfAdmission: a.timeOfAdmission || undefined,
      timeOfDischarge: a.timeOfDischarge || undefined,
    };
  }
}

// Get the patient's current open draft, or null.
export async function getDraftBill(req, res) {
  const bill = await Bill.findOne({ patientId: req.params.patientId, isFinalized: false }).lean();
  res.json(bill ? withComputed(bill) : null);
}

// Writes the patient's open draft, creating one if none exists yet. The bill
// mirrors a pre-printed pad whose lines are all present from the start, so the
// form sends the whole sheet every save and this REPLACES items rather than
// appending — re-saving after filling in one more category must not double the
// ones already there. A visit still accumulates onto one draft; it is edited
// in place instead of appended to.
export async function saveDraftBill(req, res) {
  const { items } = req.body;
  const patient = await Patient.findOne({ patientId: req.params.patientId });
  if (!patient) return res.status(404).json({ message: "Patient not found" });

  if (!Array.isArray(items)) {
    return res.status(400).json({ message: "items must be an array" });
  }
  // Empty rows are the pad's normal state — only priced lines are stored.
  const priced = items.filter((i) => i.name && Number(i.unitPrice) > 0);

  let bill = await Bill.findOne({ patientId: patient.patientId, isFinalized: false });
  if (!bill) {
    bill = new Bill({ patient: patient._id, patientId: patient.patientId, items: [] });
  }

  bill.items = priced.map(normalizeItem);
  recomputeTotals(bill);
  applyBillHeader(bill, req.body);

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

  // The combined sheet covers the whole span, so take the earliest admission
  // and the latest discharge across the bills being folded together. Each
  // time-of-day string travels with the date it was recorded against.
  const byAdmission = bills
    .filter((b) => b.admission?.dateOfAdmission)
    .sort((a, b) => new Date(a.admission.dateOfAdmission) - new Date(b.admission.dateOfAdmission));
  const byDischarge = bills
    .filter((b) => b.admission?.dateOfDischarge)
    .sort((a, b) => new Date(a.admission.dateOfDischarge) - new Date(b.admission.dateOfDischarge));
  const first = byAdmission[0];
  const last = byDischarge[byDischarge.length - 1];

  const combined = new Bill({
    patient: bills[0].patient,
    patientId,
    items: bills.flatMap((b) => b.items),
    payments: bills.flatMap((b) => b.payments),
    admission: {
      dateOfAdmission: first?.admission?.dateOfAdmission,
      dateOfDischarge: last?.admission?.dateOfDischarge,
      timeOfAdmission: first?.admission?.timeOfAdmission,
      timeOfDischarge: last?.admission?.timeOfDischarge,
    },
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
