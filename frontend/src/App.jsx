import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import Footer from "./components/Footer.jsx";
import TechSparkBackground from "./components/TechSparkBackground.jsx";
import TechSparkLoading from "./components/TechSparkLoading.jsx";
import Home from "./pages/Home.jsx";
import Events from "./pages/Events.jsx";
import Register from "./pages/Register.jsx";
import Status from "./pages/Status.jsx";
import Leaderboard from "./pages/Leaderboard.jsx";
import Login from "./pages/Login.jsx";
import Profile from "./pages/Profile.jsx";
import MagicLink from "./pages/MagicLink.jsx";
import NotFound from "./pages/NotFound.jsx";
import Exam from "./pages/Exam.jsx";
import AdminDashboard from "./admin/AdminDashboard.jsx";
import AdminScanner from "./admin/AdminScanner.jsx";
import AdminExamAttempts from "./admin/AdminExamAttempts.jsx";
import AdminRoute from "./admin/AdminRoute.jsx";
import ParticipantRoute from "./components/ParticipantRoute.jsx";
import { loadSession } from "./lib/session.js";

// Kick off the server-verified session check as early as possible (see
// session.js) so it's already in flight before Navbar/AdminRoute need the
// answer, instead of each of them independently triggering it on mount.
loadSession();

function PublicLayout({ children }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

// The Three.js scene mounts once here and stays alive across every route
// change; only its visibility toggles, so navigating never tears down or
// recreates the WebGL context.
function AppShell() {
  const { pathname } = useLocation();
  const chromeless = pathname.startsWith("/exam/") || pathname.startsWith("/admin");

  return (
    <>
      <TechSparkBackground hidden={chromeless} />
      <TechSparkLoading />
      <Routes>
        <Route path="/" element={<PublicLayout><Home /></PublicLayout>} />
        <Route path="/events" element={<PublicLayout><Events /></PublicLayout>} />
        <Route path="/register" element={<PublicLayout><Register /></PublicLayout>} />
        <Route path="/status" element={<PublicLayout><Status /></PublicLayout>} />
        <Route path="/leaderboard" element={<PublicLayout><Leaderboard /></PublicLayout>} />
        <Route path="/login" element={<PublicLayout><Login /></PublicLayout>} />
        <Route path="/profile" element={<PublicLayout><Profile /></PublicLayout>} />
        <Route path="/login/magic" element={<PublicLayout><MagicLink /></PublicLayout>} />

        {/* Exam runs chromeless — no navbar/footer/glow while a test is in progress. */}
        <Route path="/exam/:slug" element={<ParticipantRoute><Exam /></ParticipantRoute>} />

        <Route path="/admin" element={<AdminRoute roles={["admin"]}><AdminDashboard /></AdminRoute>} />
        <Route path="/admin/scan" element={<AdminRoute><AdminScanner /></AdminRoute>} />
        <Route path="/admin/exam/:slug" element={<AdminRoute roles={["admin"]}><AdminExamAttempts /></AdminRoute>} />

        <Route path="*" element={<PublicLayout><NotFound /></PublicLayout>} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
