import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";

// Login and Dashboard are the entry points, so they stay in the main bundle.
// The rest load on first navigation — no reason to make signing in wait for
// the catalog editor, the finance charts and the bill template.
const PatientDetail = lazy(() => import("./pages/PatientDetail"));
const Catalog = lazy(() => import("./pages/Catalog"));
const BillView = lazy(() => import("./pages/BillView"));
const Finance = lazy(() => import("./pages/Finance"));
const Staff = lazy(() => import("./pages/Staff"));
const AdminData = lazy(() => import("./pages/AdminData"));
const SharedPatientView = lazy(() => import("./pages/SharedPatientView"));

export default function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<div className="page-loading">Loading...</div>}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/share/:token" element={<SharedPatientView />} />
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/patients/:patientId" element={<PatientDetail />} />
            <Route path="/catalog" element={<Catalog />} />
            <Route path="/bills/:billId" element={<BillView />} />
            <Route
              path="/finance"
              element={
                <ProtectedRoute roles={["admin"]}>
                  <Finance />
                </ProtectedRoute>
              }
            />
            <Route
              path="/staff"
              element={
                <ProtectedRoute roles={["admin"]}>
                  <Staff />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin-data"
              element={
                <ProtectedRoute roles={["admin"]}>
                  <AdminData />
                </ProtectedRoute>
              }
            />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}
