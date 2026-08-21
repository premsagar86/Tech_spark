import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { loginSchema, magicLinkRequestSchema } from "../lib/schemas.js";
import { refreshSession } from "../lib/session.js";

const fieldClass =
  "w-full rounded-lg border border-border bg-raised px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:border-primary focus:outline-none";

export default function Login() {
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [showMagicLink, setShowMagicLink] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(loginSchema) });

  const magicForm = useForm({ resolver: zodResolver(magicLinkRequestSchema) });

  async function onLogin(data) {
    setError(null);
    try {
      const { role } = await api.login(data);
      await refreshSession();
      if (role === "participant") {
        navigate("/");
      } else {
        navigate(role === "scanner" ? "/admin/scan" : "/admin");
      }
    } catch (err) {
      setError(err.message);
    }
  }

  async function onRequestMagicLink(data) {
    setError(null);
    try {
      await api.requestMagicLink(data);
      setMagicLinkSent(true);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-center text-3xl">My Registration</h1>
      <p className="mt-2 text-center text-sm text-foreground-muted">
        Log in with the email + mobile number you registered with.
      </p>

      {!showMagicLink ? (
        <form onSubmit={handleSubmit(onLogin)} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm text-foreground-muted">Email</label>
            <input className={fieldClass} {...register("email")} />
            {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm text-foreground-muted">Mobile number</label>
            <input className={fieldClass} {...register("mobile")} />
            {errors.mobile && <p className="mt-1 text-xs text-red-400">{errors.mobile.message}</p>}
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-full bg-primary px-6 py-2 font-semibold text-background hover:bg-primary-light disabled:opacity-50"
          >
            {isSubmitting ? "Logging in…" : "Log In"}
          </button>

          <button
            type="button"
            onClick={() => {
              setShowMagicLink(true);
              setError(null);
            }}
            className="w-full text-center text-sm text-foreground-muted hover:text-primary"
          >
            Don't remember your mobile number?
          </button>
        </form>
      ) : magicLinkSent ? (
        <p className="mt-8 text-center text-sm text-foreground-muted">
          If that email is on a registration, a sign-in link has been sent. Check your inbox.
        </p>
      ) : (
        <form onSubmit={magicForm.handleSubmit(onRequestMagicLink)} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm text-foreground-muted">Email</label>
            <input className={fieldClass} {...magicForm.register("email")} />
            {magicForm.formState.errors.email && (
              <p className="mt-1 text-xs text-red-400">{magicForm.formState.errors.email.message}</p>
            )}
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={magicForm.formState.isSubmitting}
            className="w-full rounded-full bg-accent px-6 py-2 font-semibold text-background hover:opacity-90 disabled:opacity-50"
          >
            Send Sign-In Link
          </button>
          <button
            type="button"
            onClick={() => setShowMagicLink(false)}
            className="w-full text-center text-sm text-foreground-muted hover:text-primary"
          >
            Back to login
          </button>
        </form>
      )}

      <p className="mt-6 text-center text-xs text-foreground-muted">
        No saved session? You can also{" "}
        <Link to="/status" className="text-primary hover:underline">
          look up by registration code
        </Link>
        .
      </p>
    </section>
  );
}
