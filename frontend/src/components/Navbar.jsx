import { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import logo from "../images/logo/leadership/logo.png";
import { api } from "../lib/api.js";
import {
  getParticipantToken,
  getAdminToken,
  clearParticipantToken,
  clearAdminToken,
} from "../lib/session.js";

const baseLinks = [
  { to: "/", label: "Home" },
  { to: "/events", label: "Events" },
  { to: "/status", label: "Status" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  // Re-render on login/logout even when it happens without a route change
  // (e.g. the "Log out" button on MyRegistrationCard) — see session.js.
  const [, setSessionTick] = useState(0);
  useEffect(() => {
    const handler = () => setSessionTick((n) => n + 1);
    window.addEventListener("ts2026-session-changed", handler);
    return () => window.removeEventListener("ts2026-session-changed", handler);
  }, []);

  const isLoggedIn = Boolean(getParticipantToken() || getAdminToken());

  function handleLogout() {
    if (getAdminToken()) {
      api.adminLogout().catch(() => {});
      clearAdminToken();
    }
    if (getParticipantToken()) clearParticipantToken();
    setOpen(false);
    navigate("/");
  }

  const links = isLoggedIn ? baseLinks : [...baseLinks, { to: "/login", label: "Login" }];

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2 font-display text-2xl tracking-wider text-foreground">
          <img src={logo} alt="TechSpark" className="h-9 w-9 rounded-full object-cover" />
          Tech<span className="text-primary">Spark</span> 2026
        </Link>

        <div className="hidden gap-6 md:flex">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `text-sm font-medium transition-colors hover:text-primary ${
                  isActive ? "text-primary" : "text-foreground-muted"
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
          {isLoggedIn && (
            <button
              type="button"
              onClick={handleLogout}
              className="text-sm font-medium text-foreground-muted transition-colors hover:text-primary"
            >
              Logout
            </button>
          )}
        </div>

        <button
          className="text-foreground md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          <span className="block h-0.5 w-6 bg-current" />
          <span className="mt-1.5 block h-0.5 w-6 bg-current" />
          <span className="mt-1.5 block h-0.5 w-6 bg-current" />
        </button>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-border md:hidden"
          >
            <div className="flex flex-col gap-1 px-4 py-3">
              {links.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  onClick={() => setOpen(false)}
                  className="rounded px-2 py-2 text-sm text-foreground-muted hover:bg-raised hover:text-primary"
                >
                  {l.label}
                </NavLink>
              ))}
              {isLoggedIn && (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded px-2 py-2 text-left text-sm text-foreground-muted hover:bg-raised hover:text-primary"
                >
                  Logout
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
