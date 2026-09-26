import Service from "../models/Service.js";
import { generateItemCode, reserveItemCodes } from "../utils/generateItemCode.js";
import { escapeRegex } from "../utils/escapeRegex.js";

const CATEGORIES = ["operation", "consultation", "lab", "other"];

export async function createService(req, res) {
  const { name, category, defaultPrice } = req.body;
  if (!name || defaultPrice == null) {
    return res.status(400).json({ message: "name and defaultPrice are required" });
  }
  const itemCode = await generateItemCode("SRV");
  const service = await Service.create({
    itemCode,
    name,
    category: category?.toLowerCase(),
    defaultPrice,
  });
  res.status(201).json(service);
}

export async function listServices(req, res) {
  const { q } = req.query;
  const filter = q
    ? (() => {
        const rx = new RegExp(escapeRegex(q.trim()), "i");
        return { $or: [{ name: rx }, { itemCode: rx }] };
      })()
    : {};
  const services = await Service.find(filter).sort({ name: 1 }).lean();
  res.json(services);
}

export async function updateService(req, res) {
  const { name, category, defaultPrice } = req.body;
  const service = await Service.findByIdAndUpdate(
    req.params.id,
    { name, category: category?.toLowerCase(), defaultPrice },
    { new: true, runValidators: true }
  );
  if (!service) return res.status(404).json({ message: "Service not found" });
  res.json(service);
}

export async function deleteService(req, res) {
  const service = await Service.findByIdAndDelete(req.params.id);
  if (!service) return res.status(404).json({ message: "Service not found" });
  res.json({ message: "Service deleted" });
}

export async function bulkImportServices(req, res) {
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
    const category = row.category?.trim().toLowerCase();
    if (!name || !Number.isFinite(defaultPrice) || defaultPrice < 0) {
      skipped.push({ row: i + 2, reason: "missing/invalid name or defaultPrice" });
      continue;
    }
    valid.push({
      name,
      category: CATEGORIES.includes(category) ? category : "other",
      defaultPrice,
    });
  }

  // One counter round trip for the whole file rather than one per row.
  const codes = await reserveItemCodes("SRV", valid.length);
  const created = valid.map((s, i) => ({ ...s, itemCode: codes[i] }));

  const inserted = created.length ? await Service.insertMany(created) : [];

  res.status(201).json({
    insertedCount: inserted.length,
    skippedCount: skipped.length,
    skipped,
  });
}
