import Counter from "../models/Counter.js";

export async function generatePatientId() {
  const year = new Date().getFullYear();
  const key = `patientId_${year}`;

  const counter = await Counter.findByIdAndUpdate(
    key,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  const padded = String(counter.seq).padStart(4, "0");
  return `HR-${year}-${padded}`;
}
