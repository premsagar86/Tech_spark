import { Navigate } from "react-router-dom";
import { useSession } from "../lib/session.js";

export default function AdminRoute({ children, roles }) {
  const { role, loading } = useSession();

  // Don't redirect on the initial render — the session check is async
  // (server-verified, see session.js), so a premature check here would
  // bounce every admin to /login on every full page load/refresh.
  if (loading) return null;

  if (role !== "admin" && role !== "scanner") {
    return <Navigate to="/login" replace />;
  }
  if (roles && !roles.includes(role)) {
    // Authenticated, just not allowed here — send them to their own section
    // rather than bouncing them back to the login page.
    return <Navigate to="/admin/scan" replace />;
  }
  return children;
}
