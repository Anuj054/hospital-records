import bcrypt from "bcryptjs";
import Staff from "../models/Staff.js";
import { issueSession, clearSession } from "../utils/session.js";
import { recordLoginFailure, clearLoginFailures } from "../middleware/loginRateLimit.js";

export async function login(req, res) {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: "username and password are required" });
  }

  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    await clearLoginFailures(req);
    issueSession(res, { username, role: "admin" });
    return res.json({ message: "Logged in", username, role: "admin" });
  }

  const staff = await Staff.findOne({ username: username.toLowerCase() });
  if (staff && (await bcrypt.compare(password, staff.passwordHash))) {
    await clearLoginFailures(req);
    issueSession(res, { username: staff.username, role: "staff" });
    return res.json({ message: "Logged in", username: staff.username, role: "staff" });
  }

  await recordLoginFailure(req);
  return res.status(401).json({ message: "Invalid credentials" });
}

export function logout(req, res) {
  clearSession(res);
  res.json({ message: "Logged out" });
}

export function me(req, res) {
  res.json({ username: req.user.username, role: req.user.role });
}
