import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import client from "../api/client";
import BillForm from "../components/BillForm";
import { categoryLabel } from "../lib/billCategories";
import ShareSection from "../components/ShareSection";

export default function PatientDetail() {
  const { patientId } = useParams();
  const [patient, setPatient] = useState(null);
  const [bills, setBills] = useState([]);
  const [showBillForm, setShowBillForm] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [selectedBillIds, setSelectedBillIds] = useState([]);
  const [merging, setMerging] = useState(false);
  const [mergeError, setMergeError] = useState("");
  const navigate = useNavigate();

  async function loadPatient() {
    const res = await client.get(`/patients/${patientId}`);
    setPatient(res.data);
  }

  async function loadBills() {
    const res = await client.get(`/patients/${patientId}/bills`);
    setBills(res.data);
  }

  useEffect(() => {
    loadPatient();
    loadBills();
  }, [patientId]);

  async function handleFinalize(billId) {
    if (!confirm("Finalize this bill? It will get an invoice number and no more items can be added.")) return;
    setFinalizing(true);
    try {
      await client.post(`/bills/${billId}/finalize`);
      loadBills();
    } finally {
      setFinalizing(false);
    }
  }

  function toggleBillSelected(billId) {
    setSelectedBillIds((prev) =>
      prev.includes(billId) ? prev.filter((id) => id !== billId) : [...prev, billId]
    );
  }

  async function handleCombine() {
    if (selectedBillIds.length < 2) return;
    setMergeError("");
    setMerging(true);
    try {
      await client.post("/bills/merge", { billIds: selectedBillIds });
      setSelectedBillIds([]);
      loadBills();
    } catch (err) {
      setMergeError(err.response?.data?.message || "Could not combine bills");
    } finally {
      setMerging(false);
    }
  }

  if (!patient) return <p>Loading...</p>;

  const draft = bills.find((b) => !b.isFinalized);
  const finalizedBills = bills.filter((b) => b.isFinalized);
  const combinableBills = finalizedBills.filter((b) => b.status !== "merged");

  return (
    <div>
      <button className="btn-link" onClick={() => navigate("/")}>
        &larr; Back to patients
      </button>

      <div className="page-header">
        <div>
          <h1>{patient.name}</h1>
          <p className="patient-id-tag">{patient.patientId}</p>
        </div>
      </div>

      <div className="card patient-info-grid">
        <div>
          <strong>Age:</strong> {patient.age ?? "-"}
        </div>
        <div>
          <strong>Gender:</strong> {patient.gender ?? "-"}
        </div>
        <div>
          <strong>Phone:</strong> {patient.phone ?? "-"}
        </div>
        <div>
          <strong>Address:</strong> {patient.address ?? "-"}
        </div>
      </div>

      <ShareSection patientId={patientId} />

      <ReportsSection patientId={patientId} patient={patient} onChange={loadPatient} />

      <div className="page-header">
        <h2>Current Bill (Draft)</h2>
        <button className="btn-primary" onClick={() => setShowBillForm((v) => !v)}>
          {showBillForm ? "Cancel" : draft ? "Edit Bill" : "+ Start Bill"}
        </button>
      </div>
      <p style={{ fontSize: 13, color: "var(--muted)", marginTop: -8, marginBottom: 12 }}>
        One draft bill per visit/stay — reopen it to fill in more of the bill pad as the stay goes
        on. Finalize it when the visit/stay is complete.
      </p>

      {showBillForm && (
        <BillForm
          patientId={patientId}
          onSaved={() => {
            setShowBillForm(false);
            loadBills();
          }}
        />
      )}

      {draft ? (
        <div className="card">
          <div className="table-x-scroll">
            <table className="bill-print-table" style={{ marginBottom: 12 }}>
              <thead>
                <tr>
                  <th>Bill line</th>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Rate</th>
                  <th>Amount</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {draft.items.map((item, i) => (
                  <tr key={i}>
                    <td>{categoryLabel(item.category, "Misc.")}</td>
                    <td>{item.name}</td>
                    <td>{item.quantity}</td>
                    <td>₹{item.unitPrice.toFixed(2)}</td>
                    <td>₹{item.amount.toFixed(2)}</td>
                    <td>{item.remarks || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bill-total">Draft Total: ₹{draft.totalAmount.toFixed(2)}</div>
          <button
            className="btn-primary"
            style={{ marginTop: 12 }}
            onClick={() => handleFinalize(draft._id)}
            disabled={finalizing}
          >
            {finalizing ? "Finalizing..." : "Finalize Bill"}
          </button>
        </div>
      ) : (
        <p className="empty-state">No draft in progress. Click "+ Add Items" to start one.</p>
      )}

      <div className="page-header">
        <h2>Bill History</h2>
        {selectedBillIds.length >= 2 && (
          <button className="btn-primary" onClick={handleCombine} disabled={merging}>
            {merging ? "Combining..." : `Combine ${selectedBillIds.length} Selected Bills`}
          </button>
        )}
      </div>
      {mergeError && <div className="alert-error" style={{ marginBottom: 12 }}>{mergeError}</div>}
      {combinableBills.length >= 2 && (
        <p style={{ fontSize: 13, color: "var(--muted)", marginTop: -8, marginBottom: 12 }}>
          Select two or more bills below to combine their items into one new draft bill.
        </p>
      )}

      {finalizedBills.length === 0 ? (
        <p className="empty-state">No finalized bills yet.</p>
      ) : (
        <div className="table-x-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th></th>
                <th>Invoice #</th>
                <th>Date</th>
                <th>Total</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {finalizedBills.map((b) => (
                <tr key={b._id}>
                  <td onClick={(e) => e.stopPropagation()}>
                    {b.status !== "merged" && (
                      <input
                        type="checkbox"
                        checked={selectedBillIds.includes(b._id)}
                        onChange={() => toggleBillSelected(b._id)}
                      />
                    )}
                  </td>
                  <td>{b.billNumber}</td>
                  <td>{new Date(b.finalizedAt || b.date).toLocaleString()}</td>
                  <td>₹{b.totalAmount}</td>
                  <td>
                    <span className={`pill ${b.status}`}>{b.status}</span>
                  </td>
                  <td>
                    <Link to={`/bills/${b._id}`} className="btn-link">
                      View / Print
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const CATEGORIES = ["blood test", "xray", "scan", "other"];

function ReportsSection({ patientId, patient, onChange }) {
  const [category, setCategory] = useState("other");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", category);
      await client.post(`/patients/${patientId}/reports`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setFile(null);
      onChange();
    } catch (err) {
      setError(err.response?.data?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(reportId) {
    if (!confirm("Delete this report?")) return;
    await client.delete(`/patients/${patientId}/reports/${reportId}`);
    onChange();
  }

  return (
    <div className="card reports-card">
      <div className="section-head">
        <h2>Reports & X-Rays</h2>
      </div>

      <form className="report-upload-form" onSubmit={handleUpload}>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <label className="file-input-label">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={(e) => setFile(e.target.files[0])}
          />
          <span>{file ? file.name : "Choose a file..."}</span>
        </label>
        <button type="submit" className="btn-primary" disabled={!file || uploading}>
          {uploading ? "Uploading..." : "Upload"}
        </button>
      </form>
      {error && <div className="alert-error">{error}</div>}

      {patient.reports.length === 0 ? (
        <p className="empty-state">No reports uploaded yet.</p>
      ) : (
        <div className="reports-grid">
          {patient.reports.map((r) => (
            <ReportCard key={r._id} report={r} onDelete={() => handleDelete(r._id)} />
          ))}
        </div>
      )}
    </div>
  );
}

const IMAGE_EXT_RE = /\.(jpe?g|png|webp)$/i;

// The signed URL comes down with the patient record (all of them signed in
// one batch server-side), so a patient with eight reports no longer fires
// eight extra requests after the page mounts.
function ReportCard({ report, onDelete }) {
  const url = report.url;
  const isImage = IMAGE_EXT_RE.test(report.originalName);

  return (
    <div className="report-card">
      <div className="report-card-media">
        {isImage ? (
          url ? (
            <img src={url} alt={report.originalName} />
          ) : (
            <div className="report-card-placeholder">Loading...</div>
          )
        ) : (
          <a
            className="report-card-pdf"
            href={url || undefined}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => !url && e.preventDefault()}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M6 2h9l5 5v15a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z" />
              <path d="M14 2v6h6" />
            </svg>
            <span>{url ? "View PDF" : "Loading..."}</span>
          </a>
        )}
      </div>
      <div className="report-card-meta">
        <span className="report-category">{report.category}</span>
        <p className="report-card-name" title={report.originalName}>
          {report.originalName}
        </p>
        <p className="report-card-date">{new Date(report.uploadedAt).toLocaleDateString()}</p>
      </div>
      <button className="report-card-delete" onClick={onDelete} title="Delete report">
        &times;
      </button>
    </div>
  );
}
