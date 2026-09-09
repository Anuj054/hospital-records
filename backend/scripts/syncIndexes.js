import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../src/config/db.js";

// Production runs with autoIndex disabled (see config/db.js) so cold starts
// don't re-check every index. Run this once after changing any schema's
// indexes:  npm run sync-indexes
//
// syncIndexes() creates what's missing and drops indexes the schemas no
// longer declare, so it reports exactly what changed.
import "../src/models/Patient.js";
import "../src/models/Bill.js";
import "../src/models/Medicine.js";
import "../src/models/Service.js";
import "../src/models/Doctor.js";
import "../src/models/Staff.js";
import "../src/models/Counter.js";
import "../src/models/LoginAttempt.js";
import "../src/models/DeletionLog.js";

await connectDB();

for (const name of mongoose.modelNames()) {
  const model = mongoose.model(name);
  const dropped = await model.syncIndexes();
  const indexes = await model.collection.indexes();
  console.log(`\n${name} (${model.collection.collectionName})`);
  if (dropped.length) console.log(`  dropped: ${dropped.join(", ")}`);
  for (const idx of indexes) {
    const flags = [
      idx.unique && "unique",
      idx.sparse && "sparse",
      idx.partialFilterExpression && "partial",
    ].filter(Boolean);
    console.log(`  ${JSON.stringify(idx.key)}${flags.length ? `  [${flags.join(", ")}]` : ""}`);
  }
}

await mongoose.disconnect();
console.log("\nIndexes synced.");
