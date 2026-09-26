import mongoose from "mongoose";

const medicineSchema = new mongoose.Schema(
  {
    // unique: true already creates the index — index: true would declare a
    // second, identical one.
    itemCode: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    unit: { type: String, trim: true, default: "unit" }, // e.g. tablet, strip, bottle
    defaultPrice: { type: Number, required: true, min: 0 },
    // Bills no longer carry GST (the hospital's printed bill pad has no GST
    // line), so nothing reads this. Kept so the historical rates already on
    // catalog rows are not silently dropped.
    gstPercent: { type: Number, default: 0, min: 0, max: 100 },
  },
  { timestamps: true }
);

// The catalog is always read sorted by name; without this Mongo sorts the
// whole collection in memory on every request.
medicineSchema.index({ name: 1 });

export default mongoose.model("Medicine", medicineSchema);
