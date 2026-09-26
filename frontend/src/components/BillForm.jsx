import { useEffect, useState } from "react";
import client from "../api/client";
import { categoryLabel, flattenBillCategories } from "../lib/billCategories";

const ROWS = flattenBillCategories();
const ROOM = "room";

// Every pad line starts blank; only the ones with a price are ever stored.
function emptyRows() {
  const rows = {};
  for (const row of ROWS) {
    if (!row.isHeader) rows[row.slug] = { amount: "", remarks: "", rate: "", days: "" };
  }
  return rows;
}

function toDateInput(value) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(+d) ? "" : d.toISOString().slice(0, 10);
}

// Splits a saved draft into the pad lines this form edits, plus anything that
// isn't one. A charge counts as a pad line when its name is exactly that
// category's printed label. The rest are charges raised before the catalog was
// removed: they are shown read-only and resent untouched, so reopening an old
// draft can never quietly drop money off it.
function draftToForm(draft) {
  const rows = emptyRows();
  const carried = [];
  if (!draft) return { rows, carried };

  for (const item of draft.items || []) {
    const slug = item.category || "misc";
    if (!rows[slug] || item.name !== categoryLabel(slug)) {
      carried.push(item);
      continue;
    }
    const remarks = [rows[slug].remarks, item.remarks].filter(Boolean).join("; ");
    if (slug === ROOM) {
      // A stay billed by the day was stored as rate x days; a lump sum was
      // stored as quantity 1. Only the first refills the rate/days boxes.
      const days = item.quantity || 1;
      rows[slug] =
        days > 1
          ? { amount: String(item.amount), rate: String(item.unitPrice ?? ""), days: String(days), remarks }
          : { amount: String(item.amount), rate: "", days: "", remarks };
    } else {
      // A merged bill can carry the same pad line more than once; sum them so
      // re-saving the draft preserves the total rather than keeping only one.
      const existing = Number(rows[slug].amount) || 0;
      rows[slug] = { amount: String(existing + item.amount), rate: "", days: "", remarks };
    }
  }
  return { rows, carried };
}

export default function BillForm({ patientId, onSaved }) {
  const [rows, setRows] = useState(emptyRows);
  const [carried, setCarried] = useState([]);
  const [admission, setAdmission] = useState({
    dateOfAdmission: "",
    dateOfDischarge: "",
    timeOfAdmission: "",
    timeOfDischarge: "",
  });
  const [receivedFrom, setReceivedFrom] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    client
      .get(`/patients/${patientId}/bills/draft`)
      .then((draftRes) => {
        if (!active) return;
        // The form sends the whole sheet on save, so it has to open showing
        // what is already on the draft - otherwise saving would wipe it.
        const draft = draftRes.data;
        const { rows: loadedRows, carried: loadedCarried } = draftToForm(draft);
        setRows(loadedRows);
        setCarried(loadedCarried);
        if (draft) {
          setReceivedFrom(draft.receivedFrom || "");
          setNotes(draft.notes || "");
          setAdmission({
            dateOfAdmission: toDateInput(draft.admission?.dateOfAdmission),
            dateOfDischarge: toDateInput(draft.admission?.dateOfDischarge),
            timeOfAdmission: draft.admission?.timeOfAdmission || "",
            timeOfDischarge: draft.admission?.timeOfDischarge || "",
          });
        }
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [patientId]);

  function updateRow(slug, patch) {
    setRows((prev) => ({ ...prev, [slug]: { ...prev[slug], ...patch } }));
  }

  // Filling both halves of "Rs. ___ Per Day x ___ days" fills the amount box;
  // typing straight into the amount box just leaves them blank.
  function updateRoomRate(patch) {
    const next = { ...rows[ROOM], ...patch };
    const rate = Number(next.rate) || 0;
    const days = Number(next.days) || 0;
    if (rate && days) next.amount = String(Math.round(rate * days * 100) / 100);
    setRows((prev) => ({ ...prev, [ROOM]: next }));
  }

  const carriedTotal = carried.reduce((sum, i) => sum + i.amount, 0);
  const total =
    ROWS.filter((r) => !r.isHeader).reduce((sum, r) => sum + (Number(rows[r.slug]?.amount) || 0), 0) +
    carriedTotal;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const padItems = ROWS.filter((r) => !r.isHeader)
        .filter((r) => (Number(rows[r.slug].amount) || 0) > 0)
        .map((r) => {
          const row = rows[r.slug];
          const days = r.slug === ROOM ? Number(row.days) || 0 : 0;
          const rate = r.slug === ROOM ? Number(row.rate) || 0 : 0;
          // Storing days x rate is what lets the printed pad fill in its
          // "Rs. ____ Per Day" line; a lump sum stays quantity 1.
          const byRate = days > 0 && rate > 0;
          return {
            category: r.slug,
            name: categoryLabel(r.slug),
            quantity: byRate ? days : 1,
            unitPrice: byRate ? rate : Number(row.amount) || 0,
            remarks: row.remarks,
          };
        });

      await client.post(`/patients/${patientId}/bills/draft`, {
        notes,
        receivedFrom,
        admission,
        items: [
          ...padItems,
          ...carried.map((i) => ({
            refId: i.refId || undefined,
            category: i.category,
            name: i.name,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            remarks: i.remarks,
          })),
        ],
      });
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || "Could not save the bill");
      setSubmitting(false);
    }
  }

  if (loading) return <p className="card">Loading bill...</p>;

  return (
    <form className="card bill-form" onSubmit={handleSubmit}>
      {error && <div className="alert-error">{error}</div>}

      <div className="bill-form-header">
        <label>
          D.O.A.
          <input
            type="date"
            value={admission.dateOfAdmission}
            onChange={(e) => setAdmission({ ...admission, dateOfAdmission: e.target.value })}
          />
        </label>
        <label>
          Time of Admission
          <input
            placeholder="10:30 AM"
            value={admission.timeOfAdmission}
            onChange={(e) => setAdmission({ ...admission, timeOfAdmission: e.target.value })}
          />
        </label>
        <label>
          D.O.D.
          <input
            type="date"
            value={admission.dateOfDischarge}
            onChange={(e) => setAdmission({ ...admission, dateOfDischarge: e.target.value })}
          />
        </label>
        <label>
          T.O.D.
          <input
            placeholder="4:15 PM"
            value={admission.timeOfDischarge}
            onChange={(e) => setAdmission({ ...admission, timeOfDischarge: e.target.value })}
          />
        </label>
      </div>

      <p className="bill-form-hint">
        Type an amount against the lines that apply and leave the rest blank. Only priced
        lines are saved.
      </p>

      <div className="table-x-scroll">
        <table className="bill-items-table">
          <thead>
            <tr>
              <th className="col-sno">S.No.</th>
              <th>Particulars</th>
              <th className="col-amount">Amount (₹)</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => {
              if (row.isHeader) {
                return (
                  <tr key={row.slug} className="pad-header-row">
                    <td>{row.no}</td>
                    <td>{row.label}</td>
                    <td />
                    <td />
                  </tr>
                );
              }
              return (
                <tr key={row.slug}>
                  <td>{row.no || ""}</td>
                  <td className={row.parent ? "pad-child-label" : undefined}>
                    {row.label}
                    {row.lines?.map((line) => (
                      <div className="pad-sub-line" key={line}>
                        {line}
                      </div>
                    ))}
                    {row.perDay && (
                      <div className="pad-per-day">
                        Rs.
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          aria-label="Room rate per day"
                          value={rows[row.slug].rate}
                          onChange={(e) => updateRoomRate({ rate: e.target.value })}
                        />
                        Per Day &times;
                        <input
                          type="number"
                          min="0"
                          aria-label="Number of days"
                          value={rows[row.slug].days}
                          onChange={(e) => updateRoomRate({ days: e.target.value })}
                        />
                        days (optional)
                      </div>
                    )}
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      aria-label={`${row.label} amount`}
                      value={rows[row.slug].amount}
                      onChange={(e) => updateRow(row.slug, { amount: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`${row.label} remarks`}
                      value={rows[row.slug].remarks}
                      onChange={(e) => updateRow(row.slug, { remarks: e.target.value })}
                    />
                  </td>
                </tr>
              );
            })}

            {carried.map((item, i) => (
              <tr key={`carried-${i}`} className="pad-carried-row">
                <td />
                <td>
                  {item.name}
                  {item.quantity > 1 ? ` x${item.quantity}` : ""}
                  <div className="pad-sub-line">added before the pad format</div>
                </td>
                <td>₹{item.amount.toFixed(2)}</td>
                <td>
                  <button
                    type="button"
                    className="btn-danger-ghost"
                    onClick={() => setCarried((prev) => prev.filter((_, j) => j !== i))}
                  >
                    &times;
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bill-form-header">
        <label>
          Received with thanks from
          <input value={receivedFrom} onChange={(e) => setReceivedFrom(e.target.value)} />
        </label>
        <label>
          Notes
          <input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </div>

      <div className="bill-total">Bill total: ₹{total.toFixed(2)}</div>

      <button type="submit" className="btn-primary" disabled={submitting}>
        {submitting ? "Saving..." : "Save Bill"}
      </button>
    </form>
  );
}
