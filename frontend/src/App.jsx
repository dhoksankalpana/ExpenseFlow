
import { Navigate, Route, Routes } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Vouchers from "./pages/Vouchers";
import Reports from "./pages/Reports";
import Register from "./pages/Register";
import ProtectedRoute from "./components/ProtectedRoute";
import { useAuth } from "./context/useAuth";

function Unauthorized() {
  return (
    <main style={{ padding: 40, fontFamily: "sans-serif" }}>
      <h1>Access denied</h1>
      <p>Your account does not have permission to open this page.</p>
    </main>
  );
}

function RoleDashboard({ role }) {
  const { user } = useAuth();

  if (user?.role !== role) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Dashboard />;
}

function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={<Navigate to="/login" replace />}
      />

      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/unauthorized" element={<Unauthorized />} />

      {/* Employee routes */}
      <Route element={<ProtectedRoute allowedRoles={["employee"]} />}>
        <Route
          path="/employee/dashboard"
          element={<RoleDashboard role="employee" />}
        />
        <Route path="/employee/vouchers" element={<Vouchers />} />
        <Route path="/employee/reports" element={<Reports />} />
      </Route>

      {/* Director routes */}
      <Route element={<ProtectedRoute allowedRoles={["director"]} />}>
        <Route
          path="/director/dashboard"
          element={<RoleDashboard role="director" />}
        />
        <Route path="/director/reports" element={<Reports />} />
      </Route>

      {/* Accounts routes */}
      <Route element={<ProtectedRoute allowedRoles={["accounts"]} />}>
        <Route
          path="/accounts/dashboard"
          element={<RoleDashboard role="accounts" />}
        />
        <Route path="/accounts/reports" element={<Reports />} />
      </Route>

      <Route
        path="*"
        element={<Navigate to="/" replace />}
      />
    </Routes>
  );
}

export default App;
