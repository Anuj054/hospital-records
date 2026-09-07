import { useEffect, useState } from "react";
import client from "../api/client";

const emptyMedicine = { name: "", unit: "", defaultPrice: "", gstPercent: "" };
const emptyService = { name: "", category: "other", defaultPrice: "", gstPercent: "" };

export default function Catalog() {
  const [tab, setTab] = useState("medicines");

  return (
    <div>
      <div className="page-header">
        <h1>Medicines & Services</h1>
      </div>
      <div className="tabs">
        <button
          className={tab === "medicines" ? "tab active" : "tab"}
          onClick={() => setTab("medicines")}
        >
          Medicines
        </button>
        <button
          className={tab === "services" ? "tab active" : "tab"}
          onClick={() => setTab("services")}
        >
          Services
        </button>
        <button
          className={tab === "doctors" ? "tab active" : "tab"}
          onClick={() => setTab("doctors")}
        >
          Doctors
        </button>
      </div>
      {tab === "medicines" && <MedicinesTab />}
      {tab === "services" && <ServicesTab />}
      {tab === "doctors" && <DoctorsTab />}
    </div>
  );
}

function BulkImportForm({ endpoint, onDone }) {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) return;
    setError("");
    setResult(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await client.post(endpoint, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(res.data);
      setFile(null);
      onDone();
    } catch (err) {
      setError(err.response?.data?.message || "Bulk import failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form className="upload-bar" onSubmit={handleUpload} style={{ marginBottom: 16 }}>
      <input type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files[0])} />
      <button type="submit" className="btn-secondary" disabled={!file || uploading}>
        {uploading ? "Uploading..." : "Bulk Import CSV"}
      </button>
      {error && <span className="alert-error">{error}</span>}
      {result && (
        <span style={{ fontSize: 13, color: "var(--muted)" }}>
          Imported {result.insertedCount}, skipped {result.skippedCount}
        </span>
      )}
    </form>
  );
}

function MedicinesTab() {
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(emptyMedicine);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(emptyMedicine);

  async function load(q = "") {
    const res = await client.get("/medicines", { params: q ? { q } : {} });
    setItems(res.data);
  }

  useEffect(() => {
    load();
  }, []);

  function handleSearch(e) {
    e.preventDefault();
    load(query);
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    try {
      await client.post("/medicines", {
        ...form,
        defaultPrice: Number(form.defaultPrice),
        gstPercent: Number(form.gstPercent) || 0,
      });
      setForm(emptyMedicine);
      load(query);
    } catch (err) {
      setError(err.response?.data?.message || "Could not add medicine");
    }
  }

  async function handleDelete(id) {
    if (!confirm("Delete this medicine?")) return;
    await client.delete(`/medicines/${id}`);
    load(query);
  }

  function startEdit(item) {
    setEditingId(item._id);
    setEditForm({
      name: item.name,
      unit: item.unit,
      defaultPrice: item.defaultPrice,
      gstPercent: item.gstPercent || 0,
    });
  }

  async function handleSaveEdit(id) {
    await client.put(`/medicines/${id}`, {
      ...editForm,
      defaultPrice: Number(editForm.defaultPrice),
      gstPercent: Number(editForm.gstPercent) || 0,
    });
    setEditingId(null);
    load(query);
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>
        CSV columns: name, unit, defaultPrice, gstPercent
      </p>
      <BulkImportForm endpoint="/medicines/bulk" onDone={load} />

      <form className="card form-grid" onSubmit={handleCreate}>
        {error && <div className="alert-error span-2">{error}</div>}
        <label>
          Name *
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </label>
        <label>
          Unit (tablet/strip/bottle)
          <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
        </label>
        <label>
          Default Price *
          <input
            required
            type="number"
            step="0.01"
            value={form.defaultPrice}
            onChange={(e) => setForm({ ...form, defaultPrice: e.target.value })}
          />
        </label>
        <label>
          GST %
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={form.gstPercent}
            onChange={(e) => setForm({ ...form, gstPercent: e.target.value })}
          />
        </label>
        <button type="submit" className="btn-primary">
          Add Medicine
        </button>
      </form>

      <form className="search-bar" onSubmit={handleSearch}>
        <input
          placeholder="Search by name or item code"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit" className="btn-secondary">
          Search
        </button>
      </form>

      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Unit</th>
              <th>Price</th>
              <th>GST %</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((m) =>
              editingId === m._id ? (
                <tr key={m._id}>
                  <td>{m.itemCode}</td>
                  <td>
                    <input
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      value={editForm.unit}
                      onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      value={editForm.defaultPrice}
                      onChange={(e) => setEditForm({ ...editForm, defaultPrice: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={editForm.gstPercent}
                      onChange={(e) => setEditForm({ ...editForm, gstPercent: e.target.value })}
                    />
                  </td>
                  <td style={{ display: "flex", gap: 8 }}>
                    <button className="btn-primary" onClick={() => handleSaveEdit(m._id)}>
                      Save
                    </button>
                    <button className="btn-ghost" onClick={() => setEditingId(null)}>
                      Cancel
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={m._id}>
                  <td>{m.itemCode}</td>
                  <td>{m.name}</td>
                  <td>{m.unit}</td>
                  <td>₹{m.defaultPrice}</td>
                  <td>{m.gstPercent || 0}%</td>
                  <td style={{ display: "flex", gap: 8 }}>
                    <button className="btn-link" onClick={() => startEdit(m)}>
                      Edit
                    </button>
                    <button className="btn-danger-ghost" onClick={() => handleDelete(m._id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ServicesTab() {
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(emptyService);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(emptyService);

  async function load(q = "") {
    const res = await client.get("/services", { params: q ? { q } : {} });
    setItems(res.data);
  }

  useEffect(() => {
    load();
  }, []);

  function handleSearch(e) {
    e.preventDefault();
    load(query);
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    try {
      await client.post("/services", {
        ...form,
        defaultPrice: Number(form.defaultPrice),
        gstPercent: Number(form.gstPercent) || 0,
      });
      setForm(emptyService);
      load(query);
    } catch (err) {
      setError(err.response?.data?.message || "Could not add service");
    }
  }

  async function handleDelete(id) {
    if (!confirm("Delete this service?")) return;
    await client.delete(`/services/${id}`);
    load(query);
  }

  function startEdit(item) {
    setEditingId(item._id);
    setEditForm({
      name: item.name,
      category: item.category,
      defaultPrice: item.defaultPrice,
      gstPercent: item.gstPercent || 0,
    });
  }

  async function handleSaveEdit(id) {
    await client.put(`/services/${id}`, {
      ...editForm,
      defaultPrice: Number(editForm.defaultPrice),
      gstPercent: Number(editForm.gstPercent) || 0,
    });
    setEditingId(null);
    load(query);
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>
        CSV columns: name, category, defaultPrice, gstPercent
      </p>
      <BulkImportForm endpoint="/services/bulk" onDone={load} />

      <form className="card form-grid" onSubmit={handleCreate}>
        {error && <div className="alert-error span-2">{error}</div>}
        <label>
          Name *
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </label>
        <label>
          Category
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
            <option value="operation">Operation</option>
            <option value="consultation">Consultation</option>
            <option value="lab">Lab</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label>
          Default Price *
          <input
            required
            type="number"
            step="0.01"
            value={form.defaultPrice}
            onChange={(e) => setForm({ ...form, defaultPrice: e.target.value })}
          />
        </label>
        <label>
          GST %
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={form.gstPercent}
            onChange={(e) => setForm({ ...form, gstPercent: e.target.value })}
          />
        </label>
        <button type="submit" className="btn-primary">
          Add Service
        </button>
      </form>

      <form className="search-bar" onSubmit={handleSearch}>
        <input
          placeholder="Search by name or item code"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit" className="btn-secondary">
          Search
        </button>
      </form>

      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Category</th>
              <th>Price</th>
              <th>GST %</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((s) => (
              <tr key={s._id}>
                <td>{s.itemCode}</td>
                <td>{s.name}</td>
                <td>{s.category}</td>
                <td>₹{s.defaultPrice}</td>
                <td>{s.gstPercent || 0}%</td>
                <td>
                  <button className="btn-danger-ghost" onClick={() => handleDelete(s._id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DoctorsTab() {
  const [items, setItems] = useState([]);
  const [name, setName] = useState("");
  const [qualification, setQualification] = useState("");
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", qualification: "" });

  async function load() {
    const res = await client.get("/doctors");
    setItems(res.data);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    try {
      await client.post("/doctors", { name, qualification });
      setName("");
      setQualification("");
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not add doctor");
    }
  }

  async function handleDelete(id) {
    if (!confirm("Remove this doctor?")) return;
    await client.delete(`/doctors/${id}`);
    load();
  }

  function startEdit(doctor) {
    setEditingId(doctor._id);
    setEditForm({ name: doctor.name, qualification: doctor.qualification || "" });
  }

  async function handleSaveEdit(id) {
    await client.put(`/doctors/${id}`, editForm);
    setEditingId(null);
    load();
  }

  return (
    <div>
      <form className="card form-grid" onSubmit={handleCreate}>
        {error && <div className="alert-error span-2">{error}</div>}
        <label>
          Name *
          <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Dr. Name" />
        </label>
        <label>
          Qualification
          <input
            value={qualification}
            onChange={(e) => setQualification(e.target.value)}
            placeholder="MBBS, MD"
          />
        </label>
        <button type="submit" className="btn-primary">
          Add Doctor
        </button>
      </form>

      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Qualification</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((d) =>
              editingId === d._id ? (
                <tr key={d._id}>
                  <td>
                    <input
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      value={editForm.qualification}
                      onChange={(e) => setEditForm({ ...editForm, qualification: e.target.value })}
                      placeholder="MBBS, MD"
                    />
                  </td>
                  <td style={{ display: "flex", gap: 8 }}>
                    <button className="btn-primary" onClick={() => handleSaveEdit(d._id)}>
                      Save
                    </button>
                    <button className="btn-ghost" onClick={() => setEditingId(null)}>
                      Cancel
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={d._id}>
                  <td>{d.name}</td>
                  <td>{d.qualification || "-"}</td>
                  <td style={{ display: "flex", gap: 8 }}>
                    <button className="btn-link" onClick={() => startEdit(d)}>
                      Edit
                    </button>
                    <button className="btn-danger-ghost" onClick={() => handleDelete(d._id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
