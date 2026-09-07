import Bill from "../models/Bill.js";

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export async function getFinanceSummary(req, res) {
  const now = new Date();
  const todayStart = startOfDay(now);
  const weekStart = startOfDay(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000)); // last 7 days incl. today
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const fourteenDaysAgo = startOfDay(new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000));

  // Only finalized, non-merged bills represent real invoices/revenue.
  const bills = await Bill.find(
    { isFinalized: true, mergedInto: null },
    "totalAmount payments status"
  ).lean();

  let totalCollected = 0;
  let collectedToday = 0;
  let collectedThisWeek = 0;
  let collectedThisMonth = 0;
  let totalOutstanding = 0;
  const byMethod = { cash: 0, card: 0, upi: 0, other: 0 };
  const statusCounts = { pending: 0, partial: 0, paid: 0 };
  const dailyMap = new Map(); // 'YYYY-MM-DD' -> amount

  for (const bill of bills) {
    const paid = bill.payments.reduce((sum, p) => sum + p.amount, 0);
    totalCollected += paid;
    totalOutstanding += Math.max(bill.totalAmount - paid, 0);

    const status = paid <= 0 ? "pending" : paid >= bill.totalAmount ? "paid" : "partial";
    statusCounts[status] += 1;

    for (const p of bill.payments) {
      const paidAt = new Date(p.paidAt);
      byMethod[p.method || "other"] = (byMethod[p.method || "other"] || 0) + p.amount;

      if (paidAt >= todayStart) collectedToday += p.amount;
      if (paidAt >= weekStart) collectedThisWeek += p.amount;
      if (paidAt >= monthStart) collectedThisMonth += p.amount;

      if (paidAt >= fourteenDaysAgo) {
        const key = startOfDay(paidAt).toISOString().slice(0, 10);
        dailyMap.set(key, (dailyMap.get(key) || 0) + p.amount);
      }
    }
  }

  const dailyRevenue = [];
  for (let i = 13; i >= 0; i--) {
    const d = startOfDay(new Date(now.getTime() - i * 24 * 60 * 60 * 1000));
    const key = d.toISOString().slice(0, 10);
    dailyRevenue.push({ date: key, amount: dailyMap.get(key) || 0 });
  }

  res.json({
    totalCollected,
    collectedToday,
    collectedThisWeek,
    collectedThisMonth,
    totalOutstanding,
    byMethod,
    statusCounts,
    dailyRevenue,
    finalizedBillCount: bills.length,
  });
}
