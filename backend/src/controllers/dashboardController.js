import Patient from "../models/Patient.js";
import Bill from "../models/Bill.js";
import { startOfLocalDay } from "../utils/reportingTime.js";

export async function getStats(req, res) {
  const todayStart = startOfLocalDay();

  const [patientsToday, [totals]] = await Promise.all([
    Patient.countDocuments({ createdAt: { $gte: todayStart } }),
    // Summed inside Mongo rather than by pulling every finalized bill (and
    // all of its payments) across the wire on each dashboard load.
    Bill.aggregate([
      // mergedInto bills were folded into a combined invoice — counting them
      // here double-counted the same charges, which is why the dashboard
      // reported bills pending while Finance showed nothing outstanding.
      { $match: { isFinalized: true, mergedInto: null } },
      {
        $project: {
          totalAmount: 1,
          paidAmount: { $sum: "$payments.amount" },
          paidToday: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: "$payments",
                    as: "p",
                    cond: { $gte: ["$$p.paidAt", todayStart] },
                  },
                },
                as: "p",
                in: "$$p.amount",
              },
            },
          },
        },
      },
      {
        $group: {
          _id: null,
          collectedToday: { $sum: "$paidToday" },
          billsCollectedTodayCount: { $sum: { $cond: [{ $gt: ["$paidToday", 0] }, 1, 0] } },
          pendingBills: {
            $sum: { $cond: [{ $lt: ["$paidAmount", "$totalAmount"] }, 1, 0] },
          },
        },
      },
    ]),
  ]);

  res.json({
    collectedToday: Math.round((totals?.collectedToday ?? 0) * 100) / 100,
    billsCollectedTodayCount: totals?.billsCollectedTodayCount ?? 0,
    patientsRegisteredToday: patientsToday,
    pendingBills: totals?.pendingBills ?? 0,
  });
}
