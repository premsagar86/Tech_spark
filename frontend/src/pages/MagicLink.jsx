import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { notifySessionChanged } from "../lib/session.js";

export default function MagicLink() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("verifying");

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setStatus("error");
      return;
    }
    api
      .verifyMagicLink(token)
      .then(() => {
        notifySessionChanged();
        setStatus("success");
        setTimeout(() => navigate("/"), 1000);
      })
      .catch(() => setStatus("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="mx-auto max-w-md px-4 py-24 text-center">
      {status === "verifying" && <p className="text-foreground-muted">Signing you in…</p>}
      {status === "success" && <p className="text-accent">Signed in! Redirecting…</p>}
      {status === "error" && (
        <>
          <p className="text-red-400">This link is invalid or has expired.</p>
          <Link to="/login" className="mt-4 inline-block text-primary hover:underline">
            Back to login
          </Link>
        </>
      )}
    </section>
  );
}
