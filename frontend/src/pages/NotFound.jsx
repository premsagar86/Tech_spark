import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 text-center">
      <p className="font-body text-6xl font-bold text-primary">404</p>
      <h1 className="mt-4 font-body text-2xl font-semibold normal-case tracking-normal">
        Page not found
      </h1>
      <p className="mt-2 text-sm text-foreground-muted">
        The page you're looking for doesn't exist or may have moved.
      </p>
      <Link
        to="/"
        className="mt-6 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-background hover:bg-primary-light"
      >
        Back to home
      </Link>
    </div>
  );
}
