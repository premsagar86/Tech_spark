import { Navigate, useLocation } from "react-router-dom";
import { useSession } from "../lib/session.js";

// Mirrors admin/AdminRoute.jsx: the session check is async and server-verified
// (see lib/session.js), so don't redirect while it's still loading or every
// refresh would bounce a logged-in participant to /login.
export default function ParticipantRoute({ children }) {
  const { role, loading } = useSession();
  const location = useLocation();

  if (loading) return null;

  if (role !== "participant") {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return children;
}
