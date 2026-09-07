import { useEffect, useState } from "react";
import client from "../api/client";

export default function ShareSection({ patientId }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function loadStatus() {
    const res = await client.get(`/patients/${patientId}/share`);
    setStatus(res.data);
  }

  useEffect(() => {
    loadStatus();
  }, [patientId]);

  const shareUrl = status?.token ? `${window.location.origin}/share/${status.token}` : null;

  async function handleGenerate() {
    setLoading(true);
    try {
      await client.post(`/patients/${patientId}/share`);
      await loadStatus();
      setCopied(false);
    } finally {
      setLoading(false);
    }
  }

  async function handleRevoke() {
    if (!confirm("Revoke this share link? It will stop working immediately.")) return;
    setLoading(true);
    try {
      await client.delete(`/patients/${patientId}/share`);
      await loadStatus();
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!status) return null;

  return (
    <div className="card">
      <div className="section-head">
        <h3>Share with patient</h3>
      </div>

      {status.active ? (
        <>
          <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>
            Anyone with this link can view (no login) this patient's bills and reports. Expires{" "}
            {new Date(status.expiresAt).toLocaleString()}.
          </p>
          <div className="upload-bar">
            <input readOnly value={shareUrl} onFocus={(e) => e.target.select()} />
            <button className="btn-secondary" onClick={handleCopy}>
              {copied ? "Copied!" : "Copy Link"}
            </button>
            <button className="btn-danger-ghost" onClick={handleRevoke} disabled={loading}>
              Revoke
            </button>
          </div>
        </>
      ) : (
        <>
          <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>
            No active share link. Generate one to let the patient view their bills and reports
            online (valid for 7 days).
          </p>
          <button className="btn-primary" onClick={handleGenerate} disabled={loading}>
            {loading ? "Generating..." : "Generate Share Link"}
          </button>
        </>
      )}
    </div>
  );
}
