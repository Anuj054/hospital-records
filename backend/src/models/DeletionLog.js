import mongoose from "mongoose";

// A permanent, deliberately non-clinical record that a patient's data was
// purged: who did it, when, and how much went. Deleting health records
// should leave a trail, but the trail must not reintroduce the very data
// the purge removed — so no phone, address, reports or bill line items
// here, only the identifier and the counts.
const deletionLogSchema = new mongoose.Schema(
  {
    patientId: { type: String, required: true, index: true },
    patientName: { type: String }, // kept so the entry is legible to a human
    deletedBy: { type: String, required: true },
    billsDeleted: { type: Number, default: 0 },
    filesDeleted: { type: Number, default: 0 },
    backupConfirmed: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: "deletedAt", updatedAt: false } }
);

export default mongoose.model("DeletionLog", deletionLogSchema);
