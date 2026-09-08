import "express-async-errors"; // must load before routes: forwards async controller errors to error middleware instead of crashing the process
import express from "express";
import cors from "cors";
import compression from "compression";
import morgan from "morgan";
import cookieParser from "cookie-parser";

import authRoutes from "./routes/auth.routes.js";
import patientRoutes from "./routes/patient.routes.js";
import medicineRoutes from "./routes/medicine.routes.js";
import serviceRoutes from "./routes/service.routes.js";
import billRoutes from "./routes/bill.routes.js";
import settingsRoutes from "./routes/settings.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import publicRoutes from "./routes/public.routes.js";
import staffRoutes from "./routes/staff.routes.js";
import doctorRoutes from "./routes/doctor.routes.js";
import financeRoutes from "./routes/finance.routes.js";

const app = express();
const isProd = process.env.NODE_ENV === "production";

const allowedOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim());

app.use(
  cors({
    origin(origin, callback) {
      // no Origin header (curl, same-origin) or an allowed origin
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    // Frontend and backend sit on different domains, so every POST/PUT/DELETE
    // is preceded by an OPTIONS preflight — a full extra round trip. Letting
    // the browser cache the preflight removes it from all but the first
    // write of a session. Browsers clamp this themselves (Chrome at 2h).
    maxAge: 86400,
  })
);
app.use(compression());
app.use(express.json());
app.use(cookieParser());
// Request logging is a per-request write we don't need in production, where
// Vercel already records invocations.
if (!isProd) app.use(morgan("dev"));

// swagger-ui-express and swagger-jsdoc (which globs and parses every route
// file's JSDoc) are imported only when /api-docs is actually hit, so they
// stay off the cold-start import path that every other request pays for.
// The assembled router is cached, so only the first docs hit is slow.
let docsRouter = null;
async function getDocsRouter() {
  if (!docsRouter) {
    const [{ default: swaggerUi }, { getSwaggerSpec }] = await Promise.all([
      import("swagger-ui-express"),
      import("./config/swagger.js"),
    ]);
    docsRouter = express.Router();
    docsRouter.use(swaggerUi.serve, swaggerUi.setup(await getSwaggerSpec()));
  }
  return docsRouter;
}

app.use("/api-docs", (req, res, next) => {
  getDocsRouter()
    .then((router) => router(req, res, next))
    .catch(next);
});

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/medicines", medicineRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/doctors", doctorRoutes);
app.use("/api/finance", financeRoutes);
app.use("/api/public", publicRoutes); // unauthenticated, token-scoped share links
app.use("/api", billRoutes); // exposes /api/patients/:id/bills and /api/bills/:id

app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.use((err, req, res, next) => {
  console.error(err);

  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ message: messages.join(", ") });
  }
  if (err.name === "CastError") {
    return res.status(400).json({ message: `Invalid ${err.path}: ${err.value}` });
  }
  if (err.code === 11000) {
    return res.status(409).json({ message: "Duplicate value" });
  }
  if (err.name === "MulterError") {
    return res.status(400).json({ message: err.message });
  }

  res.status(err.status || 500).json({ message: err.message || "Server error" });
});

export default app;
