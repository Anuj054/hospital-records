import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Brand from "../components/Brand";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(username, password);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-brand-panel">
        <Brand />
        <p className="login-tagline">
          Secure sign-in for hospital billing staff. Patient records, bills, and reports stay in
          one place, for the people who need them.
        </p>
        <p className="login-quote">Every record, one login.</p>
      </div>

      <div className="login-form-panel">
        <form className="login-card" onSubmit={handleSubmit}>
          <h2>Log in</h2>
          <p className="login-subtitle">Enter your admin username and password.</p>

          {error && <div className="alert-error">{error}</div>}

          <label>
            Username
            <input value={username} onChange={(e) => setUsername(e.target.value)} required />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? "Logging in..." : "Log in"}
          </button>
        </form>
      </div>
    </div>
  );
}
