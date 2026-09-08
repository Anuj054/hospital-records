// Mirrors the Bill schema's virtuals for plain .lean() objects (which skip
// Mongoose document hydration — cheaper for read-only responses, but that
// means no getters, so we attach the same computed fields by hand).
export function withComputed(bill) {
  const paidAmount = bill.payments.reduce((sum, p) => sum + p.amount, 0);
  const balance = Math.max(bill.totalAmount - paidAmount, 0);
  const status = bill.mergedInto
    ? "merged"
    : !bill.isFinalized
    ? "draft"
    : paidAmount <= 0
    ? "pending"
    : paidAmount >= bill.totalAmount
    ? "paid"
    : "partial";
  return { ...bill, id: bill._id, paidAmount, balance, status };
}
