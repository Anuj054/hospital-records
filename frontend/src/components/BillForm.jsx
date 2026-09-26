import { useEffect, useState } from "react";
import client from "../api/client";
import { loadCatalog } from "../api/catalog";
import SearchableSelect from "./SearchableSelect";
import { BILL_CATEGORIES, categoryLabel, flattenBillCategories } from "../lib/billCategories";

const ROWS = flattenBillCategories();
const ROOM = "room";

// Every pad line starts blank; only the ones with a price are ever stored.
function emptyRows() {
  const rows = {};
  for (const row of ROWS) {
    if (!row.isHeader) rows[row.slug] = { amount: "", remarks: "", days: "" };
  }
  return rows;
}

function toDateInput(value) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(+d) ? "" : d.toISOString().slice(0, 10);
}

// Splits a saved draft back into the two things the form edits: the fixed pad
// lines, and any catalog/custom extras riding along under a category. An item
// counts as a pad line when its name is exactly that category's printed label
// — anything else was added as an extra and keeps its own name.
function draftToForm(draft) {
  const rows = emptyRows();
  const extras = [];
  if (!draft) return { rows, extras };

  for (const item of draft.items || []) {
    const slug = item.category || "misc";
    if (rows[slug] && item.name === categoryLabel(slug)) {
      const remarks = [rows[slug].remarks, item.remarks].filter(Boolean).join("; ");
      if (slug === ROOM) {
        // Room is a rate and a stay length, not a lump sum — carry both across
        // verbatim. A merged bill spanning two stays keeps the later rate.
        rows[slug] = { amount: String(item.unitPrice ?? ""), days: String(item.quantity || ""), remarks };
      } else {
        // A merged bill can carry the same pad line more than once; sum them so
        // re-saving the draft preserves the total rather than keeping only one.
        const existing = Number(rows[slug].amount) || 0;
        rows[slug] = { amount: String(existing + item.amount), days: "", remarks };
      }
    } else {
      extras.push({
        refId: item.refId || "",
        category: slug,
        name: item.name,
        quantity: item.quantity ?? 1,
        unitPrice: item.unitPrice ?? 0,
        remarks: item.remarks || "",
      });
    }
  }
  return { rows, extras };
}

export default function BillForm({ patientId, onSaved }) {
  const [catalog, setCatalog] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [rows, setRows] = useState(emptyRows);
  const [extras, setExtras] = useState([]);
  const [doctorName, setDoctorName] = useState("");
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
    // Cached in api/catalog.js — this component remounts on every toggle of
    // the bill panel, and the catalog rarely changes.
    Promise.all([loadCatalog(), client.get(`/patients/${patientId}/bills/draft`)])
      .then(([{ catalog: items, doctors: docs }, draftRes]) => {
        if (!active) return;
        setCatalog(items);
        setDoctors(docs);

        // The form sends the whole sheet on save, so it has to open showing
        // what is already on the draft — otherwise saving would wipe it.
        const draft = draftRes.data;
        const { rows: loadedRows, extras: loadedExtras } = draftToForm(draft);
        setRows(loadedRows);
        setExtras(loadedExtras);
        if (draft) {
          setDoctorName(draft.doctorName || "");
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

  function updateExtra(index, patch) {
    setExtras((prev) => prev.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  }

  // Room is the one line billed as a rate times a stay length; the rest are a
  // single figure typed straight into the amount column.
  function rowTotal(slug) {
    const row = rows[slug];
    if (!row) return 0;
    const amount = Number(row.amount) || 0;
    if (slug === ROOM) return amount * (Number(row.days) || 0);
    return amount;
  }

  const extrasTotal = extras.reduce(
    (sum, e) => sum + (Number(e.quantity) || 0) * (Number(e.unitPrice) || 0),
    0
  );
  const total = ROWS.filter((r) => !r.isHeader).reduce((sum, r) => sum + rowTotal(r.slug), 0) + extrasTotal;

  const catalogOptions = catalog.map((c) => ({
    ...c,
    label: `[${c.itemCode}] ${c.name} (₹${c.defaultPrice})`,
  }));

  function addExtra() {
    setExtras((prev) => [
      ...prev,
      { refId: "", category: "misc", name: "", quantity: 1, unitPrice: 0, remarks: "" },
    ]);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (extras.some((x) => !x.name)) {
      setError("Every extra item needs a name (pick from the catalog or type one)");
      return;
    }
    setSubmitting(true);
    try {
      const padItems = ROWS.filter((r) => !r.isHeader)
        .filter((r) => rowTotal(r.slug) > 0)
        .map((r) => ({
          category: r.slug,
          name: categoryLabel(r.slug),
          quantity: r.slug === ROOM ? Number(rows[r.slug].days) || 1 : 1,
          unitPrice: Number(rows[r.slug].amount) || 0,
          remarks: rows[r.slug].remarks,
        }));

      await client.post(`/patients/${patientId}/bills/draft`, {
        doctorName,
        notes,
        receivedFrom,
        admission,
        items: [
          ...padItems,
          ...extras.map((x) => ({
            refId: x.refId || undefined,
            category: x.category,
            name: x.name,
            quantity: Number(x.quantity) || 1,
            unitPrice: Number(x.unitPrice) || 0,
            remarks: x.remarks,
          })),
        ],
      });
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || "Could not save the bill");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="card">Loading bill...</p>;

  return (
    <form className="card bill-form" onSubmit={handleSubmit}>
      {error && <div className="alert-error">{error}</div>}

      <div className="bill-form-header">
        <label>
          Doctor / Consultant
          <select value={doctorName} onChange={(e) => setDoctorName(e.target.value)}>
            <option value="">-- select doctor --</option>
            {doctors.map((d) => (
              <option key={d._id} value={d.name}>
                {d.name}
                {d.qualification ? ` (${d.qualification})` : ""}
              </option>
            ))}
          </select>
        </label>
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
        All 15 lines of the bill pad are listed below. Enter an amount against the ones that apply
        and leave the rest blank — only priced lines are saved.
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
              const isChild = Boolean(row.parent);
              return (
                <tr key={row.slug}>
                  <td>{row.no || ""}</td>
                  <td className={isChild ? "pad-child-label" : undefined}>
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
                          value={rows[row.slug].amount}
                          onChange={(e) => updateRow(row.slug, { amount: e.target.value })}
                        />
                        Per Day &times;
                        <input
                          type="number"
                          min="0"
                          aria-label="Number of days"
                          value={rows[row.slug].days}
                          onChange={(e) => updateRow(row.slug, { days: e.target.value })}
                        />
                        days
                      </div>
                    )}
                  </td>
                  <td>
                    {row.perDay ? (
                      <span className="pad-computed">₹{rowTotal(row.slug).toFixed(2)}</span>
                    ) : (
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        aria-label={`${row.label} amount`}
                        value={rows[row.slug].amount}
                        onChange={(e) => updateRow(row.slug, { amount: e.target.value })}
                      />
                    )}
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
          </tbody>
        </table>
      </div>

      <h3 className="bill-form-subhead">Extra items from the catalog</h3>
      <p className="bill-form-hint">
        Medicines and priced services that need to appear by name. Each prints as its own line
        underneath the pad line you file it under.
      </p>

      {extras.length > 0 && (
        <div className="table-x-scroll">
          <table className="bill-items-table">
            <thead>
              <tr>
                <th>Catalog item</th>
                <th>Name on bill</th>
                <th>Files under</th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th>Amount</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {extras.map((x, index) => (
                <tr key={index}>
                  <td>
                    <SearchableSelect
                      options={catalogOptions}
                      placeholder="Search by name or code..."
                      value={x.refId ? catalog.find((c) => c._id === x.refId)?.name : ""}
                      onSelect={(opt) =>
                        updateExtra(index, {
                          refId: opt._id,
                          name: opt.name,
                          unitPrice: opt.defaultPrice,
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      value={x.name}
                      placeholder="Item name"
                      onChange={(e) => updateExtra(index, { name: e.target.value, refId: "" })}
                    />
                  </td>
                  <td>
                    <select
                      value={x.category}
                      onChange={(e) => updateExtra(index, { category: e.target.value })}
                    >
                      {BILL_CATEGORIES.flatMap((c) =>
                        c.children
                          ? c.children.map((ch) => (
                              <option key={ch.slug} value={ch.slug}>
                                {c.label} {ch.label}
                              </option>
                            ))
                          : [
                              <option key={c.slug} value={c.slug}>
                                {c.no} {c.label}
                              </option>,
                            ]
                      )}
                    </select>
                  </td>
                  <td>
                    <input
                      type="number"
                      min="1"
                      value={x.quantity}
                      onChange={(e) => updateExtra(index, { quantity: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={x.unitPrice}
                      onChange={(e) => updateExtra(index, { unitPrice: e.target.value })}
                    />
                  </td>
                  <td>₹{((Number(x.quantity) || 0) * (Number(x.unitPrice) || 0)).toFixed(2)}</td>
                  <td>
                    <button
                      type="button"
                      className="btn-danger-ghost"
                      onClick={() => setExtras((prev) => prev.filter((_, i) => i !== index))}
                    >
                      &times;
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button type="button" className="btn-secondary" onClick={addExtra}>
        + Add Catalog Item
      </button>

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
