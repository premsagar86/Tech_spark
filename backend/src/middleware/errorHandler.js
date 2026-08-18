export function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  if (status === 500) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
  res.status(status).json({ error: err.message || "Internal server error" });
}
