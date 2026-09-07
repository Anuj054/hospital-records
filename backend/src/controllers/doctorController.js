import Doctor from "../models/Doctor.js";

export async function createDoctor(req, res) {
  const { name, qualification } = req.body;
  if (!name) return res.status(400).json({ message: "name is required" });
  const doctor = await Doctor.create({ name: name.trim(), qualification: qualification?.trim() });
  res.status(201).json(doctor);
}

export async function listDoctors(req, res) {
  const doctors = await Doctor.find().sort({ name: 1 }).lean();
  res.json(doctors);
}

export async function updateDoctor(req, res) {
  const { name, qualification } = req.body;
  const doctor = await Doctor.findByIdAndUpdate(
    req.params.id,
    { name: name?.trim(), qualification: qualification?.trim() },
    { new: true, runValidators: true }
  );
  if (!doctor) return res.status(404).json({ message: "Doctor not found" });
  res.json(doctor);
}

export async function deleteDoctor(req, res) {
  const doctor = await Doctor.findByIdAndDelete(req.params.id);
  if (!doctor) return res.status(404).json({ message: "Doctor not found" });
  res.json({ message: "Doctor removed" });
}
