import { useEffect, useState } from "react";
import client from "../api/client";

export default function Staff() {
  const [staff, setStaff] = useState([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [resetId, setResetId] = useState(null);
  const [resetPassword, setResetPassword] = useState("");

  async function load() {
    const res = await client.get("/staff");
    setStaff(res.data);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    try {
      await client.post("/staff", { username, password });
      setUsername("");
      setPassword("");
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not create staff account");
    }
  }

  async function handleDelete(id) {
    if (!confirm("Remove this staff account? They will no longer be able to log in.")) return;
    await client.delete(`/staff/${id}`);
    load();
  }

  async function handleResetPassword(id) {
    if (!resetPassword || resetPassword.length < 6) return;
    await client.put(`/staff/${id}/password`, { password: resetPassword });
    setResetId(null);
    setResetPassword("");
  }

  return (
    <div>
      <div className="page-header">
        <h1>Staff</h1>
      </div>
      <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>
        Staff accounts can register patients, add bills and reports, and mark payments. They
        cannot manage the catalog, view Finance, or delete data.
      </p>

      <form className="card form-grid" onSubmit={handleCreate}>
        {error && <div className="alert-error span-2">{error}</div>}
        <label>
          Username *
          <input
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="reception1"
          />
        </label>
        <label>
          Password *
          <input
            required
            type="password"
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
          />
        </label>
        <button type="submit" className="btn-primary">
          Create Staff Account
        </button>
      </form>

      {staff.length === 0 ? (
        <p className="empty-state">No staff accounts yet.</p>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s._id}>
                  <td>{s.username}</td>
                  <td>{new Date(s.createdAt).toLocaleDateString()}</td>
                  <td style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {resetId === s._id ? (
                      <>
                        <input
                          type="password"
                          placeholder="New password"
                          minLength={6}
                          value={resetPassword}
                          onChange={(e) => setResetPassword(e.target.value)}
                          style={{
                            padding: "6px 8px",
                            border: "1px solid var(--line)",
                            borderRadius: "var(--radius)",
                          }}
                        />
                        <button className="btn-primary" onClick={() => handleResetPassword(s._id)}>
                          Save
                        </button>
                        <button className="btn-ghost" onClick={() => setResetId(null)}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="btn-link"
                          onClick={() => {
                            setResetId(s._id);
                            setResetPassword("");
                          }}
                        >
                          Reset Password
                        </button>
                        <button className="btn-danger-ghost" onClick={() => handleDelete(s._id)}>
                          Remove
                        </button>
                      </>
                    )}
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
