import Medicine from "../models/Medicine.js";
import { generateItemCode, reserveItemCodes } from "../utils/generateItemCode.js";
import { escapeRegex } from "../utils/escapeRegex.js";

export async function createMedicine(req, res) {
  const { name, unit, defaultPrice, gstPercent } = req.body;
  if (!name || defaultPrice == null) {
    return res.status(400).json({ message: "name and defaultPrice are required" });
  }
  const itemCode = await generateItemCode("MED");
  const medicine = await Medicine.create({
    itemCode,
    name,
    unit,
    defaultPrice,
    gstPercent: gstPercent || 0,
  });
  res.status(201).json(medicine);
}

export async function listMedicines(req, res) {
  const { q } = req.query;
  const filter = q
    ? (() => {
        const rx = new RegExp(escapeRegex(q.trim()), "i");
        return { $or: [{ name: rx }, { itemCode: rx }] };
      })()
    : {};
  const medicines = await Medicine.find(filter).sort({ name: 1 }).lean();
  res.json(medicines);
}

export async function updateMedicine(req, res) {
  const { name, unit, defaultPrice, gstPercent } = req.body;
  const medicine = await Medicine.findByIdAndUpdate(
    req.params.id,
    { name, unit, defaultPrice, gstPercent },
    { new: true, runValidators: true }
  );
  if (!medicine) return res.status(404).json({ message: "Medicine not found" });
  res.json(medicine);
}

export async function deleteMedicine(req, res) {
  const medicine = await Medicine.findByIdAndDelete(req.params.id);
  if (!medicine) return res.status(404).json({ message: "Medicine not found" });
  res.json({ message: "Medicine deleted" });
}

export async function bulkImportMedicines(req, res) {
  if (!req.file) return res.status(400).json({ message: "No CSV file uploaded" });

  // csv-parse is only needed by the two bulk-import endpoints, so it stays
  // off the cold-start import graph.
  const { parse } = await import("csv-parse/sync");

  let rows;
  try {
    rows = parse(req.file.buffer, { columns: true, skip_empty_lines: true, trim: true });
  } catch (err) {
    return res.status(400).json({ message: `Could not parse CSV: ${err.message}` });
  }

  const valid = [];
  const skipped = [];

  for (const [i, row] of rows.entries()) {
    const name = row.name?.trim();
    const defaultPrice = Number(row.defaultPrice);
    if (!name || !Number.isFinite(defaultPrice) || defaultPrice < 0) {
      skipped.push({ row: i + 2, reason: "missing/invalid name or defaultPrice" });
      continue;
    }
    valid.push({
      name,
      unit: row.unit?.trim() || "unit",
      defaultPrice,
      gstPercent: Number(row.gstPercent) || 0,
    });
  }

  // One counter round trip for the whole file rather than one per row.
  const codes = await reserveItemCodes("MED", valid.length);
  const created = valid.map((m, i) => ({ ...m, itemCode: codes[i] }));

  const inserted = created.length ? await Medicine.insertMany(created) : [];

  res.status(201).json({
    insertedCount: inserted.length,
    skippedCount: skipped.length,
    skipped,
  });
}
