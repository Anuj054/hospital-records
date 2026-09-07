import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, roles }) {
  const { username, role, loading } = useAuth();

  if (loading) return <div className="page-loading">Loading...</div>;
  if (!username) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(role)) return <Navigate to="/" replace />;

  return children;
}
