import app from "../src/app.js";
import { connectDB } from "../src/config/db.js";

// Vercel injects env vars directly (no .env file in production).
export default async function handler(req, res) {
  await connectDB();
  return app(req, res);
}
