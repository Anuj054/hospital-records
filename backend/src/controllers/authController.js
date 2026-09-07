import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import Staff from "../models/Staff.js";

function issueSession(res, { username, role }) {
  const token = jwt.sign({ username, role }, process.env.JWT_SECRET, {
    expiresIn: "12h",
  });

  res.cookie("token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 12 * 60 * 60 * 1000,
  });
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
  res.clearCookie("token").json({ message: "Logged out" });
}

export function me(req, res) {
  res.json({ username: req.user.username, role: req.user.role });
}
