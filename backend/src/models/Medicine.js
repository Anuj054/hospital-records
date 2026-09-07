import mongoose from "mongoose";

const medicineSchema = new mongoose.Schema(
  {
    itemCode: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    unit: { type: String, trim: true, default: "unit" }, // e.g. tablet, strip, bottle
    defaultPrice: { type: Number, required: true, min: 0 },
    gstPercent: { type: Number, default: 0, min: 0, max: 100 },
  },
  { timestamps: true }
);

export default mongoose.model("Medicine", medicineSchema);
