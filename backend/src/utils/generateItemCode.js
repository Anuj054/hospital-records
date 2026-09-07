import Counter from "../models/Counter.js";

export async function generateItemCode(prefix) {
  const counter = await Counter.findByIdAndUpdate(
    `itemCode_${prefix}`,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `${prefix}-${String(counter.seq).padStart(4, "0")}`;
}
