import { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import logo from "../images/logo/leadership/logo.png";
import { api } from "../lib/api.js";
import {
  isParticipantLoggedIn,
  isAdminLoggedIn,
  clearParticipantSession,
  clearAdminSession,
} from "../lib/session.js";

const baseLinks = [
  { to: "/", label: "Home" },
  { to: "/status", label: "Status" },
];

// "Events" only makes sense as a nav link before login — once logged in, Home
// already surfaces the events you haven't registered for yet, inline.
const loggedOutLinks = [
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

  const isLoggedIn = isParticipantLoggedIn() || isAdminLoggedIn();

  function handleLogout() {
    if (isAdminLoggedIn()) {
      clearAdminSession();
      api.adminLogout().catch(() => {});
    }
    if (isParticipantLoggedIn()) {
      clearParticipantSession();
      api.participantLogout().catch(() => {});
    }
    setOpen(false);
    navigate("/");
  }

  const links = isLoggedIn
    ? [...baseLinks, { to: "/leaderboard", label: "Leaderboard" }]
    : [...loggedOutLinks, { to: "/login", label: "Login" }];

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
            <>
              <Link
                to="/profile"
                aria-label="My profile"
                className="text-foreground-muted transition-colors hover:text-primary"
              >
                <ProfileIcon />
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="text-sm font-medium text-foreground-muted transition-colors hover:text-primary"
              >
                Logout
              </button>
            </>
          )}
        </div>

        <button
          className="relative h-6 w-6 text-foreground md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
        >
          <span
            className={`absolute left-0 block h-0.5 w-6 bg-current transition-all duration-200 ${
              open ? "top-[11px] rotate-45" : "top-[6px] rotate-0"
            }`}
          />
          <span
            className={`absolute left-0 top-[11px] block h-0.5 w-6 bg-current transition-opacity duration-200 ${
              open ? "opacity-0" : "opacity-100"
            }`}
          />
          <span
            className={`absolute left-0 block h-0.5 w-6 bg-current transition-all duration-200 ${
              open ? "top-[11px] -rotate-45" : "top-[16px] rotate-0"
            }`}
          />
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
                <>
                  <Link
                    to="/profile"
                    onClick={() => setOpen(false)}
                    className="rounded px-2 py-2 text-sm text-foreground-muted hover:bg-raised hover:text-primary"
                  >
                    My Profile
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="rounded px-2 py-2 text-left text-sm text-foreground-muted hover:bg-raised hover:text-primary"
                  >
                    Logout
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

function ProfileIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M4 20c0-3.5 3.5-6 8-6s8 2.5 8 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
