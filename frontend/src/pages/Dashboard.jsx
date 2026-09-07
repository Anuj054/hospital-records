import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import client from "../api/client";

const emptyForm = { name: "", age: "", gender: "", phone: "", address: "" };

export default function Dashboard() {
  const [query, setQuery] = useState("");
  const [patients, setPatients] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function loadPatients(q = "") {
    setLoading(true);
    try {
      const res = await client.get("/patients", { params: q ? { q } : {} });
      setPatients(res.data);
    } finally {
      setLoading(false);
    }
  }

  async function loadStats() {
    const res = await client.get("/dashboard/stats");
    setStats(res.data);
  }

  useEffect(() => {
    loadPatients();
    loadStats();
  }, []);

  function handleSearch(e) {
    e.preventDefault();
    loadPatients(query);
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    try {
      const res = await client.post("/patients", form);
      setForm(emptyForm);
      setShowForm(false);
      navigate(`/patients/${res.data.patientId}`);
    } catch (err) {
      setError(err.response?.data?.message || "Could not create patient");
    }
  }

  return (
    <div>
      <div className="dash-topbar">
        <form className="search-box" onSubmit={handleSearch}>
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            placeholder="Search patients"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </form>
        <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "Register new patient"}
        </button>
      </div>

      {stats && (
        <div className="metrics">
          <div className="metric">
            <p className="label">Collected today</p>
            <p className="value">₹{stats.collectedToday}</p>
            <p className="sub">Across {stats.billsCollectedTodayCount} bills</p>
          </div>
          <div className="metric">
            <p className="label">Patients registered today</p>
            <p className="value">{stats.patientsRegisteredToday}</p>
          </div>
          <div className="metric">
            <p className="label">Bills pending</p>
            <p className="value">{stats.pendingBills}</p>
          </div>
        </div>
      )}

      {showForm && (
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
            Age
            <input
              type="number"
              value={form.age}
              onChange={(e) => setForm({ ...form, age: e.target.value })}
            />
          </label>
          <label>
            Gender
            <select
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value })}
            >
              <option value="">--</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label>
            Phone
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </label>
          <label className="span-2">
            Address
            <input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </label>
          <button type="submit" className="btn-primary span-2">
            Create Patient
          </button>
        </form>
      )}

      <div className="section-head">
        <h3>Patients</h3>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : patients.length === 0 ? (
        <p className="empty-state">No patients found.</p>
      ) : (
        <div className="table-x-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Patient ID</th>
                <th>Name</th>
                <th>Age</th>
                <th>Gender</th>
                <th>Phone</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((p) => (
                <tr key={p._id} onClick={() => navigate(`/patients/${p.patientId}`)}>
                  <td>{p.patientId}</td>
                  <td>{p.name}</td>
                  <td>{p.age ?? "-"}</td>
                  <td>{p.gender ?? "-"}</td>
                  <td>{p.phone ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
