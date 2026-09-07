import { useEffect, useState } from "react";
import client from "../api/client";

const METHOD_LABELS = { cash: "Cash", card: "Card", upi: "UPI", other: "Other" };

export default function Finance() {
  const [data, setData] = useState(null);

  useEffect(() => {
    client.get("/finance/summary").then((res) => setData(res.data));
  }, []);

  if (!data) return <p className="page-loading">Loading...</p>;

  const methodTotal = Object.values(data.byMethod).reduce((a, b) => a + b, 0);

  return (
    <div>
      <div className="page-header">
        <h1>Finance</h1>
      </div>

      <div className="metrics">
        <div className="metric">
          <p className="label">Collected all-time</p>
          <p className="value">₹{data.totalCollected.toLocaleString()}</p>
          <p className="sub">Across {data.finalizedBillCount} finalized bills</p>
        </div>
        <div className="metric">
          <p className="label">Outstanding balance</p>
          <p className="value">₹{data.totalOutstanding.toLocaleString()}</p>
        </div>
        <div className="metric">
          <p className="label">Collected today</p>
          <p className="value">₹{data.collectedToday.toLocaleString()}</p>
        </div>
      </div>

      <div className="metrics">
        <div className="metric">
          <p className="label">Collected this week</p>
          <p className="value">₹{data.collectedThisWeek.toLocaleString()}</p>
        </div>
        <div className="metric">
          <p className="label">Collected this month</p>
          <p className="value">₹{data.collectedThisMonth.toLocaleString()}</p>
        </div>
        <div className="metric">
          <p className="label">Bills by status</p>
          <p className="value" style={{ fontSize: 15 }}>
            <span className="pill pending">{data.statusCounts.pending} pending</span>{" "}
            <span className="pill partial">{data.statusCounts.partial} partial</span>{" "}
            <span className="pill paid">{data.statusCounts.paid} paid</span>
          </p>
        </div>
      </div>

      <div className="section-head">
        <h3>Last 14 days</h3>
      </div>
      <div className="card">
        <RevenueBarChart data={data.dailyRevenue} />
      </div>

      <div className="section-head">
        <h3>Collections by payment method</h3>
      </div>
      <div className="card">
        {methodTotal === 0 ? (
          <p className="empty-state">No payments recorded yet.</p>
        ) : (
          <div className="method-breakdown">
            {Object.entries(data.byMethod).map(([method, amount]) => (
              <div className="method-row" key={method}>
                <span className="method-label">{METHOD_LABELS[method] || method}</span>
                <div className="method-bar-track">
                  <div
                    className="method-bar-fill"
                    style={{ width: `${methodTotal ? (amount / methodTotal) * 100 : 0}%` }}
                  />
                </div>
                <span className="method-amount">₹{amount.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RevenueBarChart({ data }) {
  const [hoverIndex, setHoverIndex] = useState(null);
  const max = Math.max(...data.map((d) => d.amount), 1);
  const chartHeight = 160;

  return (
    <div className="revenue-chart">
      <div className="revenue-chart-bars">
        {data.map((d, i) => {
          const barHeight = Math.max((d.amount / max) * chartHeight, d.amount > 0 ? 3 : 0);
          const label = new Date(d.date).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          });
          return (
            <div
              key={d.date}
              className="revenue-chart-col"
              onMouseEnter={() => setHoverIndex(i)}
              onMouseLeave={() => setHoverIndex(null)}
            >
              {hoverIndex === i && (
                <div className="revenue-chart-tooltip">
                  <strong>₹{d.amount.toLocaleString()}</strong>
                  <span>{label}</span>
                </div>
              )}
              <div className="revenue-chart-bar-wrap" style={{ height: chartHeight }}>
                <div
                  className={`revenue-chart-bar${hoverIndex === i ? " active" : ""}`}
                  style={{ height: barHeight }}
                />
              </div>
              <span className="revenue-chart-tick">{label.split(" ")[1]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
