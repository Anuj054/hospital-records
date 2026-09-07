import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import html2pdf from "html2pdf.js";
import client from "../api/client";

export default function BillView() {
  const { billId } = useParams();
  const [bill, setBill] = useState(null);
  const [patient, setPatient] = useState(null);
  const [settings, setSettings] = useState(null);
  const printRef = useRef(null);
  const navigate = useNavigate();

  async function load() {
    const billRes = await client.get(`/bills/${billId}`);
    setBill(billRes.data);
    const [patientRes, settingsRes] = await Promise.all([
      client.get(`/patients/${billRes.data.patientId}`),
      client.get("/settings"),
    ]);
    setPatient(patientRes.data);
    setSettings(settingsRes.data);
  }

  useEffect(() => {
    load();
  }, [billId]);

  function handleDownload() {
    html2pdf()
      .set({
        margin: 10,
        filename: `${bill.billNumber}.pdf`,
        html2canvas: { scale: 2 },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      })
      .from(printRef.current)
      .save();
  }

  if (!bill || !patient || !settings) return <p>Loading...</p>;

  return (
    <div>
      <div className="bill-view-actions no-print">
        <button className="btn-link" onClick={() => navigate(-1)}>
          &larr; Back
        </button>
        <button className="btn-primary" onClick={handleDownload}>
          Download PDF
        </button>
      </div>

      <div className="bill-template" ref={printRef}>
        <div className="bill-header">
          <h1>{settings.hospitalName}</h1>
          {settings.address && <p>{settings.address}</p>}
          {settings.phone && <p>Phone: {settings.phone}</p>}
          {settings.gstNo && <p>GSTIN: {settings.gstNo}</p>}
        </div>

        <hr />

        <div className="bill-meta">
          <div>
            <strong>Invoice #:</strong> {bill.billNumber}
          </div>
          <div>
            <strong>Date:</strong> {new Date(bill.finalizedAt || bill.date).toLocaleString()}
          </div>
        </div>
        <div className="bill-meta">
          <div>
            <strong>Patient:</strong> {patient.name} ({patient.patientId})
          </div>
          {bill.doctorName && (
            <div>
              <strong>Doctor:</strong> {bill.doctorName}
            </div>
          )}
        </div>

        <div className="table-x-scroll">
          <table className="bill-print-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Item</th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th>GST %</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {bill.items.map((item, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>{item.name}</td>
                  <td>{item.quantity}</td>
                  <td>₹{item.unitPrice.toFixed(2)}</td>
                  <td>{item.gstPercent || 0}%</td>
                  <td>₹{item.amount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan="5" className="bill-total-label">
                  Subtotal
                </td>
                <td className="bill-total-value">₹{bill.subtotal.toFixed(2)}</td>
              </tr>
              {bill.gstAmount > 0 && (
                <tr>
                  <td colSpan="5" className="bill-total-label">
                    GST
                  </td>
                  <td className="bill-total-value">₹{bill.gstAmount.toFixed(2)}</td>
                </tr>
              )}
              <tr>
                <td colSpan="5" className="bill-total-label">
                  Total
                </td>
                <td className="bill-total-value">₹{bill.totalAmount.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {bill.notes && (
          <p className="bill-notes">
            <strong>Notes:</strong> {bill.notes}
          </p>
        )}

        <div className="signature-row">
          <div className="signature-box">
            <div className="signature-line" />
            <p>Patient / Attendant Signature</p>
          </div>
          <div className="signature-box">
            <div className="signature-line" />
            <p>
              For {settings.hospitalName}
              <br />
              (Signature &amp; Stamp)
            </p>
          </div>
        </div>

        <p className="bill-footer">Thank you for choosing {settings.hospitalName}.</p>
      </div>

      <PaymentLedger bill={bill} onChange={load} />
    </div>
  );
}

function PaymentLedger({ bill, onChange }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleRecordPayment(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await client.post(`/bills/${bill._id}/payments`, {
        amount: Number(amount),
        method,
        note,
      });
      setAmount("");
      setNote("");
      onChange();
    } catch (err) {
      setError(err.response?.data?.message || "Could not record payment");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card no-print">
      <div className="page-header" style={{ margin: 0 }}>
        <h2>Payments</h2>
        <span className={`pill ${bill.status}`}>{bill.status}</span>
      </div>

      {bill.payments.length === 0 ? (
        <p className="empty-state">No payments recorded yet.</p>
      ) : (
        <ul className="payments-list">
          {bill.payments.map((p, i) => (
            <li key={i} className="payment-row">
              <span className="amount">₹{p.amount.toFixed(2)}</span>
              <span>{p.method}</span>
              {p.note && <span>{p.note}</span>}
              <span className="date">{new Date(p.paidAt).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="balance-summary">
        <span>Paid: ₹{bill.paidAmount.toFixed(2)}</span>
        <span className="balance-due">Balance due: ₹{bill.balance.toFixed(2)}</span>
      </div>

      {bill.balance > 0 && (
        <form className="payment-form" onSubmit={handleRecordPayment}>
          {error && <div className="alert-error">{error}</div>}
          <label>
            Amount
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={bill.balance}
              value={amount}
              required
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <label>
            Method
            <select value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="upi">UPI</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label>
            Note
            <input value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? "Recording..." : "Record Payment"}
          </button>
        </form>
      )}
    </div>
  );
}
