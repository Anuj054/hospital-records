import Counter from "../models/Counter.js";

function format(prefix, seq) {
  return `${prefix}-${String(seq).padStart(4, "0")}`;
}

export async function generateItemCode(prefix) {
  const [code] = await reserveItemCodes(prefix, 1);
  return code;
}

// Claims `count` sequential codes in a single atomic $inc instead of one
// round trip per code. A CSV import used to await generateItemCode() inside
// its row loop, so a 200-row upload meant 200 sequential round trips to
// Atlas — well past the function timeout once the database isn't local.
export async function reserveItemCodes(prefix, count) {
  if (count <= 0) return [];

  const counter = await Counter.findByIdAndUpdate(
    `itemCode_${prefix}`,
    { $inc: { seq: count } },
    { new: true, upsert: true }
  );

  // findByIdAndUpdate returns the value *after* the increment, so the block
  // we just claimed ends at counter.seq.
  const firstSeq = counter.seq - count + 1;
  return Array.from({ length: count }, (_, i) => format(prefix, firstSeq + i));
}
