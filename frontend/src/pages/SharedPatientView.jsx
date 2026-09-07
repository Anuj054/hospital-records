import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import html2pdf from "html2pdf.js";
import axios from "axios";
import Brand from "../components/Brand";
import { getApiBaseUrl } from "../api/baseUrl";

const publicClient = axios.create({
  baseURL: getApiBaseUrl(),
});

function isImageReport(report) {
  return /\.(jpe?g|png|webp)$/i.test(report.originalName);
}

export default function SharedPatientView() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const printRef = useRef(null);

  useEffect(() => {
    publicClient
      .get(`/public/share/${token}`)
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.message || "Could not load this link"));
  }, [token]);

  async function waitForImages() {
    const images = Array.from(printRef.current.querySelectorAll("img"));
    await Promise.all(
      images.map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise((resolve) => {
              img.addEventListener("load", resolve, { once: true });
              img.addEventListener("error", resolve, { once: true });
            })
      )
    );
  }

  async function handleDownload() {
    await waitForImages();
    html2pdf()
      .set({
        margin: 10,
        filename: `${data.patient.patientId}-records.pdf`,
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      })
      .from(printRef.current)
      .save();
  }

  if (error) {
    return (
      <div className="shared-page">
        <div className="shared-header">
          <Brand />
        </div>
        <div className="card" style={{ maxWidth: 500, margin: "40px auto", textAlign: "center" }}>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return <p className="page-loading">Loading...</p>;

  const { patient, bills, expiresAt } = data;

  return (
    <div className="shared-page">
      <div className="shared-header no-print">
        <Brand />
        <button className="btn-primary" onClick={handleDownload}>
          Download PDF (all bills & reports)
        </button>
      </div>

      <div className="shared-content" ref={printRef}>
        <div className="card">
          <h1>{patient.name}</h1>
          <p className="patient-id-tag">{patient.patientId}</p>
          <div className="patient-info-grid" style={{ marginTop: 12 }}>
            <div>
              <strong>Age:</strong> {patient.age ?? "-"}
            </div>
            <div>
              <strong>Gender:</strong> {patient.gender ?? "-"}
            </div>
          </div>
        </div>

        <h2>Bills</h2>
        {bills.length === 0 ? (
          <p className="empty-state">No bills yet.</p>
        ) : (
          bills.map((bill) => (
            <div className="card" key={bill._id}>
              <div className="page-header" style={{ margin: "0 0 8px" }}>
                <div>
                  <strong>{bill.billNumber}</strong> &middot;{" "}
                  {new Date(bill.finalizedAt || bill.date).toLocaleString()}
                  {bill.doctorName && <> &middot; Dr. {bill.doctorName.replace(/^Dr\.?\s*/i, "")}</>}
                </div>
                <span className={`pill ${bill.status}`}>{bill.status}</span>
              </div>
              <div className="table-x-scroll">
                <table className="bill-print-table">
                  <thead>
                    <tr>
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
                      <td colSpan="4" className="bill-total-label">
                        Subtotal
                      </td>
                      <td className="bill-total-value">₹{bill.subtotal.toFixed(2)}</td>
                    </tr>
                    {bill.gstAmount > 0 && (
                      <tr>
                        <td colSpan="4" className="bill-total-label">
                          GST
                        </td>
                        <td className="bill-total-value">₹{bill.gstAmount.toFixed(2)}</td>
                      </tr>
                    )}
                    <tr>
                      <td colSpan="4" className="bill-total-label">
                        Total
                      </td>
                      <td className="bill-total-value">₹{bill.totalAmount.toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td colSpan="4" className="bill-total-label">
                        Paid
                      </td>
                      <td className="bill-total-value">₹{bill.paidAmount.toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td colSpan="4" className="bill-total-label">
                        Balance due
                      </td>
                      <td className="bill-total-value">₹{bill.balance.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ))
        )}

        <h2>Reports &amp; X-Rays</h2>
        {patient.reports.length === 0 ? (
          <p className="empty-state">No reports uploaded.</p>
        ) : (
          <ul className="report-list">
            {patient.reports.map((r) => (
              <SharedReportRow key={r._id} token={token} report={r} />
            ))}
          </ul>
        )}

        <p className="bill-footer no-print">
          This link expires {new Date(expiresAt).toLocaleString()}.
        </p>
      </div>
    </div>
  );
}

function SharedReportRow({ token, report }) {
  const [url, setUrl] = useState(null);
  const isImage = isImageReport(report);

  useEffect(() => {
    // Fetch eagerly (not just on click) so the image is already loaded by the
    // time "Download PDF" snapshots the page — html2pdf can only capture
    // images that have finished loading.
    publicClient
      .get(`/public/share/${token}/reports/${report._id}/url`)
      .then((res) => setUrl(res.data.url));
  }, [token, report._id]);

  return (
    <li className="report-row report-row-media">
      <div className="report-row-header">
        <span className="report-category">{report.category}</span>
        <span>{report.originalName}</span>
        <span className="report-date">{new Date(report.uploadedAt).toLocaleDateString()}</span>
        {!isImage &&
          (url ? (
            <a className="btn-link no-print" href={url} target="_blank" rel="noopener noreferrer">
              View PDF
            </a>
          ) : (
            <span className="btn-link no-print">Loading...</span>
          ))}
      </div>
      {isImage && (
        <div className="report-thumb">
          {url ? <img src={url} alt={report.originalName} /> : <p className="empty-state">Loading image...</p>}
        </div>
      )}
    </li>
  );
}
