import Bill from "../models/Bill.js";
import {
  TIME_ZONE,
  recentLocalDayKeys,
  startOfLocalDay,
  startOfLocalDaysAgo,
  startOfLocalMonth,
} from "../utils/reportingTime.js";

const DAILY_REVENUE_DAYS = 14;

export async function getFinanceSummary(req, res) {
  const now = new Date();
  const todayStart = startOfLocalDay(now);
  const weekStart = startOfLocalDaysAgo(6, now); // last 7 days incl. today
  const monthStart = startOfLocalMonth(now);
  const seriesStart = startOfLocalDaysAgo(DAILY_REVENUE_DAYS - 1, now);

  // One round trip, computed in the database. The previous version read every
  // finalized bill (with its full payments array) into the function and
  // reduced in JS — fine at 70 bills, but it grows without bound and the
  // whole collection had to cross the wire each time the page was opened.
  const [facets] = await Bill.aggregate([
    // Only finalized, non-merged bills represent real invoices/revenue.
    { $match: { isFinalized: true, mergedInto: null } },
    {
      $facet: {
        billTotals: [
          { $project: { totalAmount: 1, paidAmount: { $sum: "$payments.amount" } } },
          {
            $group: {
              _id: null,
              finalizedBillCount: { $sum: 1 },
              totalCollected: { $sum: "$paidAmount" },
              totalOutstanding: {
                $sum: { $max: [{ $subtract: ["$totalAmount", "$paidAmount"] }, 0] },
              },
              pending: { $sum: { $cond: [{ $lte: ["$paidAmount", 0] }, 1, 0] } },
              paid: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $gt: ["$paidAmount", 0] },
                        { $gte: ["$paidAmount", "$totalAmount"] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              partial: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $gt: ["$paidAmount", 0] },
                        { $lt: ["$paidAmount", "$totalAmount"] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
            },
          },
        ],
        collectedWindows: [
          { $unwind: "$payments" },
          {
            $group: {
              _id: null,
              collectedToday: {
                $sum: {
                  $cond: [{ $gte: ["$payments.paidAt", todayStart] }, "$payments.amount", 0],
                },
              },
              collectedThisWeek: {
                $sum: {
                  $cond: [{ $gte: ["$payments.paidAt", weekStart] }, "$payments.amount", 0],
                },
              },
              collectedThisMonth: {
                $sum: {
                  $cond: [{ $gte: ["$payments.paidAt", monthStart] }, "$payments.amount", 0],
                },
              },
            },
          },
        ],
        byMethod: [
          { $unwind: "$payments" },
          {
            $group: {
              _id: { $ifNull: ["$payments.method", "other"] },
              amount: { $sum: "$payments.amount" },
            },
          },
        ],
        dailyRevenue: [
          { $unwind: "$payments" },
          { $match: { "payments.paidAt": { $gte: seriesStart } } },
          {
            $group: {
              // Bucketed by the hospital's local calendar day, not UTC.
              _id: {
                $dateToString: {
                  format: "%Y-%m-%d",
                  date: "$payments.paidAt",
                  timezone: TIME_ZONE,
                },
              },
              amount: { $sum: "$payments.amount" },
            },
          },
        ],
      },
    },
  ]);

  const billTotals = facets.billTotals[0] || {};
  const windows = facets.collectedWindows[0] || {};

  const byMethod = { cash: 0, card: 0, upi: 0, other: 0 };
  for (const row of facets.byMethod) {
    byMethod[row._id] = (byMethod[row._id] || 0) + round2(row.amount);
  }

  const amountByDay = new Map(facets.dailyRevenue.map((r) => [r._id, r.amount]));
  const dailyRevenue = recentLocalDayKeys(DAILY_REVENUE_DAYS, now).map((date) => ({
    date,
    amount: round2(amountByDay.get(date) || 0),
  }));

  res.json({
    totalCollected: round2(billTotals.totalCollected || 0),
    collectedToday: round2(windows.collectedToday || 0),
    collectedThisWeek: round2(windows.collectedThisWeek || 0),
    collectedThisMonth: round2(windows.collectedThisMonth || 0),
    totalOutstanding: round2(billTotals.totalOutstanding || 0),
    byMethod,
    statusCounts: {
      pending: billTotals.pending || 0,
      partial: billTotals.partial || 0,
      paid: billTotals.paid || 0,
    },
    dailyRevenue,
    finalizedBillCount: billTotals.finalizedBillCount || 0,
  });
}

// Summing floats in Mongo can leave trailing 0.000000001s; these are rupee
// figures shown verbatim in the UI.
function round2(n) {
  return Math.round(n * 100) / 100;
}
