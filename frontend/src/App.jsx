import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import Footer from "./components/Footer.jsx";
import GlowBackground from "./components/GlowBackground.jsx";
import Home from "./pages/Home.jsx";
import Events from "./pages/Events.jsx";
import Register from "./pages/Register.jsx";
import Status from "./pages/Status.jsx";
import Leaderboard from "./pages/Leaderboard.jsx";
import Login from "./pages/Login.jsx";
import MagicLink from "./pages/MagicLink.jsx";
import AdminDashboard from "./admin/AdminDashboard.jsx";
import AdminScanner from "./admin/AdminScanner.jsx";
import AdminRoute from "./admin/AdminRoute.jsx";

function PublicLayout({ children }) {
  return (
    <>
      <GlowBackground />
      <Navbar />
      <main>{children}</main>
      <Footer />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PublicLayout><Home /></PublicLayout>} />
        <Route path="/events" element={<PublicLayout><Events /></PublicLayout>} />
        <Route path="/register" element={<PublicLayout><Register /></PublicLayout>} />
        <Route path="/status" element={<PublicLayout><Status /></PublicLayout>} />
        <Route path="/leaderboard" element={<PublicLayout><Leaderboard /></PublicLayout>} />
        <Route path="/login" element={<PublicLayout><Login /></PublicLayout>} />
        <Route path="/login/magic" element={<PublicLayout><MagicLink /></PublicLayout>} />

        <Route path="/admin" element={<AdminRoute roles={["admin"]}><AdminDashboard /></AdminRoute>} />
        <Route path="/admin/scan" element={<AdminRoute><AdminScanner /></AdminRoute>} />
      </Routes>
    </BrowserRouter>
  );
}
