import bcrypt from "bcryptjs";
import Staff from "../models/Staff.js";

export async function listStaff(req, res) {
  const staff = await Staff.find({}, "username createdAt").sort({ createdAt: -1 });
  res.json(staff);
}

export async function createStaff(req, res) {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: "username and password are required" });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: "password must be at least 6 characters" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const staff = await Staff.create({ username: username.toLowerCase(), passwordHash });

  res.status(201).json({ _id: staff._id, username: staff.username, createdAt: staff.createdAt });
}

export async function resetStaffPassword(req, res) {
  const { password } = req.body;
  if (!password || password.length < 6) {
    return res.status(400).json({ message: "password must be at least 6 characters" });
  }

  const staff = await Staff.findById(req.params.id);
  if (!staff) return res.status(404).json({ message: "Staff not found" });

  staff.passwordHash = await bcrypt.hash(password, 10);
  await staff.save();
  res.json({ message: "Password updated" });
}

export async function deleteStaff(req, res) {
  const staff = await Staff.findByIdAndDelete(req.params.id);
  if (!staff) return res.status(404).json({ message: "Staff not found" });
  res.json({ message: "Staff removed" });
}
