import jwt from "jsonwebtoken";

export function requireAdmin(req, res, next) {
  const token = req.cookies?.adminToken || req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Not authenticated" });
  try {
    req.admin = jwt.verify(token, process.env.JWT_ADMIN_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
}

export function issueAdminToken(admin) {
  return jwt.sign(
    { adminId: admin.id, username: admin.username, role: admin.role },
    process.env.JWT_ADMIN_SECRET,
    { expiresIn: "12h" }
  );
}

// Chain after requireAdmin, which sets req.admin from the verified token.
export function requireRole(...allowedRoles) {
  return function (req, res, next) {
    if (!allowedRoles.includes(req.admin?.role)) {
      return res.status(403).json({ error: "Not authorized for this action" });
    }
    next();
  };
}
