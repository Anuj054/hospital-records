import { useEffect, useState } from "react";
import client from "../api/client";
import { loadJSZip } from "../lib/zip";

// Admin-only backup and purge. The backup is assembled in the browser: the
// server hands back the database rows plus a signed URL per report file, and
// we fetch the files here. Serverless responses are capped at about 4.5MB, so
// a server-built archive would fall over as soon as a few x-rays went in.
export default function AdminData() {
  const [patients, setPatients] = useState([]);
  const [deletions, setDeletions] = useState([]);
  const [progress, setProgress] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Purge dialog state
  const [target, setTarget] = useState(null);
  const [typed, setTyped] = useState("");
  const [backedUp, setBackedUp] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    const [p, d] = await Promise.all([client.get("/patients"), client.get("/admin/deletions")]);
    setPatients(p.data);
    setDeletions(d.data);
  }

  useEffect(() => {
    load().catch((err) => setError(err.response?.data?.message || "Could not load admin data"));
  }, []);

  async function downloadBackup(patientId) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      setProgress("Fetching records...");
      const { data } = await client.get("/admin/backup", {
        params: patientId ? { patientId } : {},
      });

      const JSZip = await loadJSZip();
      const zip = new JSZip();

      zip.file("backup.json", JSON.stringify(data, null, 2));
      for (const [name, rows] of Object.entries(data.collections)) {
        zip.file(`data/${name}.json`, JSON.stringify(rows, null, 2));
      }

      // Fetch each report file and put it beside the data, foldered by
      // patient so the archive is browsable without the JSON.
      let done = 0;
      let failed = 0;
      for (const f of data.reportFiles) {
        done += 1;
        setProgress(`Downloading report ${done} of ${data.reportFiles.length}...`);
        if (!f.url) {
          failed += 1;
          continue;
        }
        try {
          const res = await fetch(f.url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          zip.file(`reports/${f.storedPath}`, await res.blob());
        } catch {
          failed += 1;
        }
      }

      setProgress("Compressing...");
      const blob = await zip.generateAsync({ type: "blob" });

      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      const name = patientId
        ? `backup-${patientId}-${stamp}.zip`
        : `backup-full-${stamp}.zip`;
      triggerDownload(blob, name);

      const { patients: np, bills: nb, reportFiles: nr } = data.counts;
      setNotice(
        `Downloaded ${name} — ${np} patient(s), ${nb} bill(s), ${nr - failed} of ${nr} report file(s).` +
          (failed ? ` ${failed} file(s) could not be fetched and are NOT in the archive.` : "")
      );
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Backup failed");
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    setError("");
    try {
      const { data } = await client.delete(`/admin/patients/${target.patientId}`, {
        data: { confirm: typed, backupConfirmed: backedUp },
      });
      setNotice(
        `${data.message}. Removed ${data.billsDeleted} bill(s) and ${data.filesDeleted} file(s).`
      );
      closeDialog();
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  function closeDialog() {
    setTarget(null);
    setTyped("");
    setBackedUp(false);
  }

  const canDelete = target && typed === target.patientId && backedUp && !deleting;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Backup &amp; Data</h1>
          <p className="patient-id-tag">Admin only</p>
        </div>
      </div>

      {error && <div className="alert-error">{error}</div>}
      {notice && <div className="alert-success">{notice}</div>}

      <div className="card">
        <div className="section-head">
          <h3>Download a backup</h3>
        </div>
        <p className="admin-hint">
          The archive contains every record as JSON plus the original report and x-ray files.
          Keep it somewhere safe — it holds patient health information in the clear.
        </p>
        <button className="btn-primary" onClick={() => downloadBackup(null)} disabled={busy}>
          {busy ? progress || "Working..." : "Download full database backup (.zip)"}
        </button>
      </div>

      <div className="card">
        <div className="section-head">
          <h3>Patients</h3>
        </div>
        <p className="admin-hint">
          Back up a single patient, or permanently remove them from the database and file
          storage. Deleting cannot be undone.
        </p>
        {patients.length === 0 ? (
          <p className="empty-state">No patients.</p>
        ) : (
          <div className="table-x-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Patient ID</th>
                  <th>Name</th>
                  <th>Phone</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {patients.map((p) => (
                  <tr key={p._id}>
                    <td>{p.patientId}</td>
                    <td>{p.name}</td>
                    <td>{p.phone ?? "-"}</td>
                    <td className="admin-row-actions">
                      <button
                        className="btn-link"
                        disabled={busy}
                        onClick={() => downloadBackup(p.patientId)}
                      >
                        Back up
                      </button>
                      <button
                        className="btn-danger-ghost"
                        disabled={busy}
                        onClick={() => {
                          setTarget(p);
                          setTyped("");
                          setBackedUp(false);
                          setError("");
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <div className="section-head">
          <h3>Deletion history</h3>
        </div>
        <p className="admin-hint">
          A permanent record of purged patients. Kept deliberately free of clinical detail.
        </p>
        {deletions.length === 0 ? (
          <p className="empty-state">Nothing has been deleted.</p>
        ) : (
          <div className="table-x-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Patient ID</th>
                  <th>Name</th>
                  <th>By</th>
                  <th>Bills</th>
                  <th>Files</th>
                  <th>Backed up first</th>
                </tr>
              </thead>
              <tbody>
                {deletions.map((d) => (
                  <tr key={d._id}>
                    <td>{new Date(d.deletedAt).toLocaleString()}</td>
                    <td>{d.patientId}</td>
                    <td>{d.patientName ?? "-"}</td>
                    <td>{d.deletedBy}</td>
                    <td>{d.billsDeleted}</td>
                    <td>{d.filesDeleted}</td>
                    <td>{d.backupConfirmed ? "yes" : "no"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {target && (
        <div className="modal-backdrop" onClick={closeDialog}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Delete {target.name}?</h3>
            <p className="admin-hint">
              This permanently removes <strong>{target.patientId}</strong>, every bill, and every
              uploaded report and x-ray from both the database and file storage. There is no undo.
            </p>

            <button
              className="btn-secondary"
              disabled={busy}
              onClick={() => downloadBackup(target.patientId)}
            >
              {busy ? progress || "Working..." : "Download this patient's backup first"}
            </button>

            <label className="modal-check">
              <input
                type="checkbox"
                checked={backedUp}
                onChange={(e) => setBackedUp(e.target.checked)}
              />
              <span>I have saved a backup of this patient</span>
            </label>

            <label>
              Type <strong>{target.patientId}</strong> to confirm
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={target.patientId}
                autoFocus
              />
            </label>

            <div className="modal-actions">
              <button className="btn-secondary" onClick={closeDialog} disabled={deleting}>
                Cancel
              </button>
              <button className="btn-danger" onClick={confirmDelete} disabled={!canDelete}>
                {deleting ? "Deleting..." : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// The browser can't be handed a Blob directly, so it goes through a
// temporary object URL that we revoke once the download has started.
function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
