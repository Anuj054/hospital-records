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
  const [archiveOpen, setArchiveOpen] = useState(false);

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
        <div className="admin-actions">
          <button className="btn-primary" onClick={() => downloadBackup(null)} disabled={busy}>
            {busy ? progress || "Working..." : "Download full database backup (.zip)"}
          </button>
          <button
            className="btn-secondary"
            onClick={() => setArchiveOpen(true)}
            disabled={busy}
          >
            Archive &amp; clear old records...
          </button>
        </div>
      </div>

      {archiveOpen && (
        <ArchiveDialog
          onClose={() => setArchiveOpen(false)}
          onDone={async (msg) => {
            setNotice(msg);
            setArchiveOpen(false);
            await load();
          }}
        />
      )}

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

const PRESETS = [
  { label: "Older than 2 months", months: 2 },
  { label: "Older than 3 months", months: 3 },
  { label: "Older than 6 months", months: 6 },
  { label: "Older than 1 year", months: 12 },
];

function cutoffFor(months) {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d;
}

// Archive-and-clear, in a strict order: pick a cutoff, see exactly who it
// covers, download that archive, and only then may the purge run — against
// the list the archive actually contained, never a fresh query.
function ArchiveDialog({ onClose, onDone }) {
  const [months, setMonths] = useState(2);
  const [customDate, setCustomDate] = useState("");
  const [includeUnpaid, setIncludeUnpaid] = useState(false);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Set once the archive has been downloaded; holds the patient IDs it
  // contained, which is the only thing the purge is allowed to act on.
  const [archived, setArchived] = useState(null);
  const [progress, setProgress] = useState("");
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState("");

  const cutoff = months === "custom" ? (customDate ? new Date(customDate) : null) : cutoffFor(months);

  useEffect(() => {
    if (!cutoff || Number.isNaN(cutoff.getTime())) {
      setPreview(null);
      return;
    }
    let active = true;
    setLoading(true);
    setError("");
    // Changing the cutoff invalidates any archive already taken.
    setArchived(null);
    setTyped("");
    client
      .get("/admin/purge-preview", { params: { before: cutoff.toISOString() } })
      .then((res) => active && setPreview(res.data))
      .catch((err) => active && setError(err.response?.data?.message || "Preview failed"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [months, customDate]);

  const selected = preview
    ? includeUnpaid
      ? [...preview.eligible, ...preview.heldBack]
      : preview.eligible
    : [];

  async function downloadArchive() {
    setBusy(true);
    setError("");
    try {
      setProgress("Fetching records...");
      const { data } = await client.get("/admin/backup", {
        params: { before: cutoff.toISOString(), includeUnpaid: includeUnpaid ? "true" : "false" },
      });

      if (data.patientIds.length === 0) {
        setError("Nothing matched that cutoff — no archive was created.");
        return;
      }

      const JSZip = await loadJSZip();
      const zip = new JSZip();
      zip.file("backup.json", JSON.stringify(data, null, 2));
      for (const [name, rows] of Object.entries(data.collections)) {
        zip.file(`data/${name}.json`, JSON.stringify(rows, null, 2));
      }

      let failed = 0;
      let done = 0;
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
      const name = `archive-before-${cutoff.toISOString().slice(0, 10)}-${stamp}.zip`;
      triggerDownload(blob, name);

      if (failed > 0) {
        // Refuse to unlock the purge on an incomplete archive — deleting
        // records whose x-rays never made it into the zip loses them.
        setError(
          `${failed} of ${data.reportFiles.length} report file(s) could not be downloaded, so this archive is incomplete. Nothing has been deleted. Try again.`
        );
        return;
      }

      setArchived({
        filename: name,
        patientIds: data.patientIds,
        counts: data.counts,
        truncated: data.truncatedToBatchLimit,
      });
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Archive failed");
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  async function purgeArchived() {
    setBusy(true);
    setError("");
    const failures = [];
    let deleted = 0;
    try {
      // One patient at a time: the per-patient endpoint is the same path
      // already proven for single deletes, and it keeps each request well
      // inside the serverless time limit however many patients there are.
      for (const [i, pid] of archived.patientIds.entries()) {
        setProgress(`Deleting ${i + 1} of ${archived.patientIds.length} (${pid})...`);
        try {
          await client.delete(`/admin/patients/${pid}`, {
            data: { confirm: pid, backupConfirmed: true },
          });
          deleted += 1;
        } catch (err) {
          failures.push(`${pid}: ${err.response?.data?.message || err.message}`);
        }
      }

      const summary =
        `Archived to ${archived.filename} and deleted ${deleted} patient(s).` +
        (failures.length ? ` ${failures.length} failed — see below.` : "");

      if (failures.length) {
        setError(`Some deletions failed:\n${failures.join("\n")}`);
        setArchived({ ...archived, patientIds: [] });
        return;
      }
      onDone(summary);
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  const canPurge = archived && archived.patientIds.length > 0 && typed === "DELETE" && !busy;

  return (
    <div className="modal-backdrop" onClick={busy ? undefined : onClose}>
      <div className="modal-card modal-wide" onClick={(e) => e.stopPropagation()}>
        <h3>Archive &amp; clear old records</h3>
        <p className="admin-hint">
          Download an archive of records older than your chosen cutoff, then remove them from the
          database and file storage. Age is judged by last activity — the most recent of
          registration, record edit, bill, or report — so a patient still being treated is never
          counted as old.
        </p>

        <label>
          Cutoff
          <select
            value={months}
            onChange={(e) =>
              setMonths(e.target.value === "custom" ? "custom" : Number(e.target.value))
            }
            disabled={busy}
          >
            {PRESETS.map((p) => (
              <option key={p.months} value={p.months}>
                {p.label}
              </option>
            ))}
            <option value="custom">Custom date...</option>
          </select>
        </label>

        {months === "custom" && (
          <label>
            No activity on or after
            <input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              disabled={busy}
            />
          </label>
        )}

        {cutoff && !Number.isNaN(cutoff.getTime()) && (
          <p className="admin-hint">
            Covers patients with no activity since <strong>{cutoff.toLocaleDateString()}</strong>.
          </p>
        )}

        {error && <div className="alert-error archive-error">{error}</div>}
        {loading && <p className="empty-state">Checking...</p>}

        {preview && !loading && (
          <>
            <div className="archive-summary">
              <div>
                <span className="value">{selected.length}</span>
                <span className="label">patient(s)</span>
              </div>
              <div>
                <span className="value">{selected.reduce((s, c) => s + c.billCount, 0)}</span>
                <span className="label">bill(s)</span>
              </div>
              <div>
                <span className="value">{selected.reduce((s, c) => s + c.reportCount, 0)}</span>
                <span className="label">report file(s)</span>
              </div>
            </div>

            {preview.heldBack.length > 0 && (
              <label className="modal-check">
                <input
                  type="checkbox"
                  checked={includeUnpaid}
                  onChange={(e) => {
                    setIncludeUnpaid(e.target.checked);
                    setArchived(null);
                    setTyped("");
                  }}
                  disabled={busy}
                />
                <span>
                  Also include {preview.heldBack.length} patient(s) who still owe money or have a
                  bill in progress
                </span>
              </label>
            )}

            {preview.eligibleTotal > preview.maxBatch && (
              <p className="admin-hint">
                {preview.eligibleTotal} patients match, but one run handles{" "}
                {preview.maxBatch} at a time. Repeat this for the rest.
              </p>
            )}

            {selected.length > 0 ? (
              <div className="table-x-scroll archive-list">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Patient ID</th>
                      <th>Name</th>
                      <th>Last activity</th>
                      <th>Bills</th>
                      <th>Files</th>
                      <th>Owes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.map((c) => (
                      <tr key={c.patientId}>
                        <td>{c.patientId}</td>
                        <td>{c.name}</td>
                        <td>{new Date(c.lastActivityAt).toLocaleDateString()}</td>
                        <td>{c.billCount}</td>
                        <td>{c.reportCount}</td>
                        <td>{c.outstanding > 0 ? `₹${c.outstanding}` : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="empty-state">Nothing is older than that cutoff.</p>
            )}
          </>
        )}

        {/* Step 1: archive. Step 2 only appears once step 1 has succeeded. */}
        {selected.length > 0 && !archived && (
          <button className="btn-primary" onClick={downloadArchive} disabled={busy}>
            {busy ? progress || "Working..." : `Download archive of ${selected.length} patient(s)`}
          </button>
        )}

        {archived && archived.patientIds.length > 0 && (
          <div className="archive-step2">
            <div className="alert-success">
              Saved {archived.filename} — {archived.counts.patients} patient(s),{" "}
              {archived.counts.bills} bill(s), {archived.counts.reportFiles} report file(s).
            </div>
            <p className="admin-hint">
              Check the file opens before continuing. Deleting these{" "}
              {archived.patientIds.length} patient(s) cannot be undone.
            </p>
            <label>
              Type <strong>DELETE</strong> to confirm
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder="DELETE"
                disabled={busy}
              />
            </label>
          </div>
        )}

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose} disabled={busy}>
            {archived ? "Done" : "Cancel"}
          </button>
          {archived && archived.patientIds.length > 0 && (
            <button className="btn-danger" onClick={purgeArchived} disabled={!canPurge}>
              {busy
                ? progress || "Deleting..."
                : `Delete ${archived.patientIds.length} archived patient(s)`}
            </button>
          )}
        </div>
      </div>
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
