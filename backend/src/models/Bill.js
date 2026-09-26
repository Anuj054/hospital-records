import mongoose from "mongoose";
import { BILL_CATEGORY_SLUGS, DEFAULT_BILL_CATEGORY } from "../constants/billCategories.js";

const billItemSchema = new mongoose.Schema(
  {
    refId: { type: mongoose.Schema.Types.ObjectId }, // Medicine or Service _id, optional for custom items
    // Which pre-printed line of the bill pad this charge sits on. The printed
    // bill groups by this, so an item without one lands under "Misc.".
    category: {
      type: String,
      enum: BILL_CATEGORY_SLUGS,
      default: DEFAULT_BILL_CATEGORY,
    },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1, default: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 }, // quantity * unitPrice, captured at billing time
    remarks: { type: String, trim: true }, // the pad's REMARKS column
    addedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const paymentSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true, min: 0.01 },
    method: { type: String, enum: ["cash", "card", "upi", "other"], default: "cash" },
    note: { type: String, trim: true },
    paidAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const billSchema = new mongoose.Schema(
  {
    // Only assigned when the bill is finalized; drafts have none (sparse
    // unique index lets many drafts coexist with no billNumber).
    billNumber: { type: String, unique: true, sparse: true },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
    patientId: { type: String, required: true }, // denormalized for fast lookup; indexed below
    doctorName: { type: String, trim: true },
    items: { type: [billItemSchema], default: [] },
    totalAmount: { type: Number, default: 0, min: 0 }, // sum of item amounts; amount owed
    // The pad's D.O.A. / D.O.D. / Time of Admission / T.O.D. block. Held per
    // bill rather than per patient so a readmission gets its own dates and
    // reprinting an old bill still shows the stay it was raised for. Times are
    // free text ("10:30 AM") because that is how they are written on paper.
    admission: {
      dateOfAdmission: { type: Date },
      dateOfDischarge: { type: Date },
      timeOfAdmission: { type: String, trim: true },
      timeOfDischarge: { type: String, trim: true },
    },
    receivedFrom: { type: String, trim: true }, // "Received with thanks from ....."
    payments: { type: [paymentSchema], default: [] },
    notes: { type: String, trim: true },
    date: { type: Date, default: Date.now }, // when the draft was started
    isFinalized: { type: Boolean, default: false },
    finalizedAt: { type: Date },
    // Set when this bill's items were folded into a combined bill; the
    // original stays in the DB (audit trail) instead of being deleted.
    mergedInto: { type: mongoose.Schema.Types.ObjectId, ref: "Bill", default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Enforces at most one open draft per patient. Note this index contains
// ONLY draft documents (that's what partialFilterExpression means), so it
// cannot serve lookups for a patient's finalized bills — those need the
// index below.
billSchema.index(
  { patientId: 1, isFinalized: 1 },
  { unique: true, partialFilterExpression: { isFinalized: false } }
);

// The hot read path: every bill for one patient, newest first.
billSchema.index({ patientId: 1, date: -1 });

// Backs the finance and dashboard aggregations, which both match on
// exactly this pair before doing any work.
billSchema.index({ isFinalized: 1, mergedInto: 1 });

billSchema.virtual("paidAmount").get(function () {
  return this.payments.reduce((sum, p) => sum + p.amount, 0);
});

billSchema.virtual("balance").get(function () {
  return Math.max(this.totalAmount - this.paidAmount, 0);
});

billSchema.virtual("status").get(function () {
  if (this.mergedInto) return "merged";
  if (!this.isFinalized) return "draft";
  if (this.paidAmount <= 0) return "pending";
  if (this.paidAmount >= this.totalAmount) return "paid";
  return "partial";
});

export default mongoose.model("Bill", billSchema);
