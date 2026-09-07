import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import PatientDetail from "./pages/PatientDetail";
import Catalog from "./pages/Catalog";
import BillView from "./pages/BillView";
import Finance from "./pages/Finance";
import Staff from "./pages/Staff";
import SharedPatientView from "./pages/SharedPatientView";

export default function App() {
  return (
    <AuthProvider>
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
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
