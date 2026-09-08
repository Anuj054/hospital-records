import jwt from "jsonwebtoken";
import { renewSessionIfStale } from "../utils/session.js";

export function requireAuth(req, res, next) {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ message: "Not authenticated" });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { username, role }
    // Rolling session: any activity past the halfway mark hands back a fresh
    // cookie, so continued use never ends in a surprise logout.
    renewSessionIfStale(res, payload);
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired session" });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Not authorized for this action" });
    }
    next();
  };
}
