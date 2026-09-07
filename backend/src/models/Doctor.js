import mongoose from "mongoose";

const doctorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    qualification: { type: String, trim: true }, // e.g. "MBBS, MD"
  },
  { timestamps: true }
);

export default mongoose.model("Doctor", doctorSchema);
