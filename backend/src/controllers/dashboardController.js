import Patient from "../models/Patient.js";
import Bill from "../models/Bill.js";

export async function getStats(req, res) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [patientsToday, bills] = await Promise.all([
    Patient.countDocuments({ createdAt: { $gte: startOfDay } }),
    Bill.find({ isFinalized: true }, "totalAmount payments"),
  ]);

  let collectedToday = 0;
  let billsCollectedToday = new Set();
  let pendingBills = 0;

  for (const bill of bills) {
    const paidAmount = bill.payments.reduce((sum, p) => sum + p.amount, 0);
    if (paidAmount < bill.totalAmount) pendingBills += 1;

    for (const p of bill.payments) {
      if (p.paidAt >= startOfDay) {
        collectedToday += p.amount;
        billsCollectedToday.add(bill._id.toString());
      }
    }
  }

  res.json({
    collectedToday,
    billsCollectedTodayCount: billsCollectedToday.size,
    patientsRegisteredToday: patientsToday,
    pendingBills,
  });
}
