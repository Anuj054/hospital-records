import mongoose from "mongoose";

const billItemSchema = new mongoose.Schema(
  {
    refId: { type: mongoose.Schema.Types.ObjectId }, // Medicine or Service _id, optional for custom items
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1, default: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 }, // quantity * unitPrice, captured at billing time
    gstPercent: { type: Number, default: 0, min: 0, max: 100 },
    gstAmount: { type: Number, default: 0, min: 0 }, // amount * gstPercent / 100
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
    subtotal: { type: Number, default: 0, min: 0 }, // sum of item amounts, before GST
    gstAmount: { type: Number, default: 0, min: 0 }, // sum of item GST amounts
    totalAmount: { type: Number, default: 0, min: 0 }, // subtotal + gstAmount; amount owed
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

// Serves both general patientId lookups (index prefix) and, via the partial
// filter, enforces at most one open draft per patient at a time.
billSchema.index(
  { patientId: 1, isFinalized: 1 },
  { unique: true, partialFilterExpression: { isFinalized: false } }
);

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
