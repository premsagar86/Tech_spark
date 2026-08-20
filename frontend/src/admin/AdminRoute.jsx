import { Navigate } from "react-router-dom";
import { isAdminLoggedIn, getAdminRole } from "../lib/session.js";

export default function AdminRoute({ children, roles }) {
  if (!isAdminLoggedIn()) {
    return <Navigate to="/login" replace />;
  }
  if (roles && !roles.includes(getAdminRole())) {
    // Authenticated, just not allowed here — send them to their own section
    // rather than bouncing them back to the login page.
    return <Navigate to="/admin/scan" replace />;
  }
  return children;
}
