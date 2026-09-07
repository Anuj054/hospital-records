import mongoose from "mongoose";

const reportSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      enum: ["blood test", "xray", "scan", "other"],
      default: "other",
    },
    originalName: { type: String, required: true },
    storedPath: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const patientSchema = new mongoose.Schema(
  {
    patientId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    age: { type: Number },
    gender: { type: String, enum: ["male", "female", "other"] },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
    reports: [reportSchema],
    shareToken: { type: String, index: true, unique: true, sparse: true },
    shareTokenExpiresAt: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model("Patient", patientSchema);
