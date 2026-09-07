import mongoose from "mongoose";

const serviceSchema = new mongoose.Schema(
  {
    itemCode: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ["operation", "consultation", "lab", "other"],
      default: "other",
    },
    defaultPrice: { type: Number, required: true, min: 0 },
    gstPercent: { type: Number, default: 0, min: 0, max: 100 },
  },
  { timestamps: true }
);

export default mongoose.model("Service", serviceSchema);
