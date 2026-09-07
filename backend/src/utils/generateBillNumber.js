import Counter from "../models/Counter.js";

export async function generateBillNumber() {
  const year = new Date().getFullYear();
  const key = `billNumber_${year}`;

  const counter = await Counter.findByIdAndUpdate(
    key,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  const padded = String(counter.seq).padStart(4, "0");
  return `INV-${year}-${padded}`;
}
