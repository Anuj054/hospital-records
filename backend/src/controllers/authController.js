import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import Staff from "../models/Staff.js";

// In production the frontend and backend live on different Vercel domains,
// so the auth cookie must be sent cross-site — that requires SameSite=None,
// which browsers only honor when the cookie is also Secure (HTTPS).
// Locally both run on http://localhost, where SameSite=None+Secure would be
// dropped by the browser entirely, so we fall back to Lax there.
const isProd = process.env.NODE_ENV === "production";
const cookieOptions = {
  httpOnly: true,
  sameSite: isProd ? "none" : "lax",
  secure: isProd,
  maxAge: 12 * 60 * 60 * 1000,
};

function issueSession(res, { username, role }) {
  const token = jwt.sign({ username, role }, process.env.JWT_SECRET, {
    expiresIn: "12h",
  });

  res.cookie("token", token, cookieOptions);
}

export async function login(req, res) {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: "username and password are required" });
  }

  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    issueSession(res, { username, role: "admin" });
    return res.json({ message: "Logged in", username, role: "admin" });
  }

  const staff = await Staff.findOne({ username: username.toLowerCase() });
  if (staff && (await bcrypt.compare(password, staff.passwordHash))) {
    issueSession(res, { username: staff.username, role: "staff" });
    return res.json({ message: "Logged in", username: staff.username, role: "staff" });
  }

  return res.status(401).json({ message: "Invalid credentials" });
}

export function logout(req, res) {
  // clearCookie only needs the identifying attributes (path/domain/sameSite/
  // secure) — passing maxAge is deprecated in Express 4 and ignored in 5.
  const { maxAge, ...clearOptions } = cookieOptions;
  res.clearCookie("token", clearOptions).json({ message: "Logged out" });
}

export function me(req, res) {
  res.json({ username: req.user.username, role: req.user.role });
}
