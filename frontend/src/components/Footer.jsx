import { Link } from "react-router-dom";
import { coordinators } from "../data/placeholderContent.js";
import logo from "../images/logo/leadership/logo.png";

export default function Footer() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-3">
        <div>
          <div className="flex items-center gap-2 font-display text-xl tracking-wider">
            <img src={logo} alt="TechSpark" className="h-8 w-8 rounded-full object-cover" />
            Tech<span className="text-primary">Spark</span> 2026
          </div>
          <p className="mt-2 text-sm text-foreground-muted">
            Ideathon, Hackathon, and four more events — one fest.
          </p>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-foreground">Quick links</h4>
          <ul className="mt-2 space-y-1 text-sm text-foreground-muted">
            <li><Link to="/events" className="hover:text-primary">Events</Link></li>
            <li><Link to="/status" className="hover:text-primary">Check status</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-foreground">Coordinators</h4>
          <ul className="mt-2 space-y-1 text-sm text-foreground-muted">
            {coordinators.map((c) => (
              <li key={c.name}>
                {c.name} — {c.phone} 
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-border py-4 text-center text-xs text-foreground-muted">
        © 2026 TechSpark. Built for the fest.
      </div>
    </footer>
  );
}
