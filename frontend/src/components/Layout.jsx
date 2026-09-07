import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Brand from "./Brand";

export default function Layout() {
  const { username, role, logout } = useAuth();
  const navigate = useNavigate();
  const [navOpen, setNavOpen] = useState(false);

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  const initials = username ? username.slice(0, 2).toUpperCase() : "?";

  return (
    <div className="app-shell">
      <header className="mobile-topbar">
        <button
          className="hamburger-btn"
          onClick={() => setNavOpen(true)}
          aria-label="Open menu"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <Brand size={17} />
      </header>

      {navOpen && <div className="sidebar-backdrop" onClick={() => setNavOpen(false)} />}

      <aside className={`sidebar${navOpen ? " open" : ""}`}>
        <div className="sidebar-top">
          <Brand />
          <button
            className="sidebar-close"
            onClick={() => setNavOpen(false)}
            aria-label="Close menu"
          >
            &times;
          </button>
        </div>
        <nav className="sidebar-nav" onClick={() => setNavOpen(false)}>
          <NavLink to="/" end>
            Overview
          </NavLink>
          <NavLink to="/catalog">Medicines & Services</NavLink>
          {role === "admin" && <NavLink to="/finance">Finance</NavLink>}
          {role === "admin" && <NavLink to="/staff">Staff</NavLink>}
        </nav>
        <div className="sidebar-user">
          <div className="sidebar-avatar">{initials}</div>
          <div className="sidebar-user-info">
            <p className="name">{username}</p>
            <p className="role">{role === "admin" ? "Admin" : "Staff"}</p>
          </div>
          <button className="sidebar-logout" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </aside>
      <main className="app-content">
        <Outlet />
      </main>
    </div>
  );
}
