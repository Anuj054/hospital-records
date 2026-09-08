import app from "../src/app.js";
import { connectDB } from "../src/config/db.js";

// Requests that never touch Mongo shouldn't wait on the connection — on a
// cold instance that handshake is the single slowest thing we do. CORS
// preflights in particular are pure header negotiation.
function needsDatabase(req) {
  if (req.method === "OPTIONS") return false;
  const path = (req.url || "").split("?")[0];
  return path !== "/api/health";
}

// Vercel injects env vars directly (no .env file in production).
export default async function handler(req, res) {
  if (needsDatabase(req)) await connectDB();
  return app(req, res);
}
