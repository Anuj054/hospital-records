import { useEffect, useState } from "react";
import client from "../api/client";
import { loadCatalog } from "../api/catalog";
import SearchableSelect from "./SearchableSelect";

export default function BillForm({ patientId, onAdded }) {
  const [catalog, setCatalog] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [items, setItems] = useState([{ refId: "", name: "", quantity: 1, unitPrice: 0, gstPercent: 0 }]);
  const [doctorName, setDoctorName] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Cached in api/catalog.js — this component remounts on every toggle of
    // the "+ Add Items" panel, and the catalog rarely changes.
    let active = true;
    loadCatalog().then(({ catalog: items, doctors: docs }) => {
      if (!active) return;
      setCatalog(items);
      setDoctors(docs);
    });
    return () => {
      active = false;
    };
  }, []);

  function updateItem(index, patch) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function handleCatalogSelect(index, catalogItem) {
    updateItem(index, {
      refId: catalogItem._id,
      name: catalogItem.name,
      unitPrice: catalogItem.defaultPrice,
      gstPercent: catalogItem.gstPercent || 0,
    });
  }

  const catalogOptions = catalog.map((c) => ({
    ...c,
    label: `[${c.itemCode}] ${c.name} (₹${c.defaultPrice})`,
  }));

  function addRow() {
    setItems((prev) => [...prev, { refId: "", name: "", quantity: 1, unitPrice: 0, gstPercent: 0 }]);
  }

  function removeRow(index) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  // unitPrice is GST-inclusive: total is the raw sum, GST is backed out of it.
  const total = items.reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0), 0);
  const gstAmount = items.reduce((sum, it) => {
    const amount = (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0);
    const gstPercent = Number(it.gstPercent) || 0;
    return sum + (amount * gstPercent) / (100 + gstPercent);
  }, 0);
  const subtotal = total - gstAmount;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (items.some((it) => !it.name)) {
      setError("Every item needs a name (pick from catalog or type a custom item)");
      return;
    }
    setSubmitting(true);
    try {
      await client.post(`/patients/${patientId}/bills/draft`, {
        doctorName,
        notes,
        items: items.map((it) => ({
          refId: it.refId || undefined,
          name: it.name,
          quantity: Number(it.quantity),
          unitPrice: Number(it.unitPrice),
          gstPercent: Number(it.gstPercent) || 0,
        })),
      });
      onAdded();
    } catch (err) {
      setError(err.response?.data?.message || "Could not add items");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="card bill-form" onSubmit={handleSubmit}>
      {error && <div className="alert-error">{error}</div>}

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

      <div className="table-x-scroll">
        <table className="bill-items-table">
        <thead>
          <tr>
            <th>Item (pick from catalog, or type custom below)</th>
            <th>Custom name</th>
            <th>Qty</th>
            <th>Unit Price</th>
            <th>GST %</th>
            <th>Amount</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, index) => (
            <tr key={index}>
              <td>
                <SearchableSelect
                  options={catalogOptions}
                  placeholder="Search by name or code..."
                  value={it.refId ? catalog.find((c) => c._id === it.refId)?.name : ""}
                  onSelect={(opt) => handleCatalogSelect(index, opt)}
                />
              </td>
              <td>
                <input
                  value={it.name}
                  placeholder="Item name"
                  onChange={(e) => updateItem(index, { name: e.target.value, refId: "" })}
                />
              </td>
              <td>
                <input
                  type="number"
                  min="1"
                  value={it.quantity}
                  onChange={(e) => updateItem(index, { quantity: e.target.value })}
                />
              </td>
              <td>
                <input
                  type="number"
                  step="0.01"
                  value={it.unitPrice}
                  onChange={(e) => updateItem(index, { unitPrice: e.target.value })}
                />
              </td>
              <td>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={it.gstPercent}
                  onChange={(e) => updateItem(index, { gstPercent: e.target.value })}
                />
              </td>
              <td>₹{((Number(it.quantity) || 0) * (Number(it.unitPrice) || 0)).toFixed(2)}</td>
              <td>
                {items.length > 1 && (
                  <button type="button" className="btn-danger-ghost" onClick={() => removeRow(index)}>
                    &times;
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
        </table>
      </div>

      <button type="button" className="btn-secondary" onClick={addRow}>
        + Add Item
      </button>

      <label>
        Notes
        <input value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>

      <div className="bill-total-breakdown">
        <div>
          <span>Subtotal</span>
          <span>₹{subtotal.toFixed(2)}</span>
        </div>
        {gstAmount > 0 && (
          <div>
            <span>GST</span>
            <span>₹{gstAmount.toFixed(2)}</span>
          </div>
        )}
      </div>
      <div className="bill-total">Adding: ₹{total.toFixed(2)}</div>

      <button type="submit" className="btn-primary" disabled={submitting}>
        {submitting ? "Adding..." : "Add to Bill"}
      </button>
    </form>
  );
}
