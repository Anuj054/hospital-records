import mongoose from "mongoose";

// Failed-login counters. These live in Mongo rather than process memory
// because serverless instances are ephemeral and there are several of them:
// an in-memory counter resets on every cold start and only ever sees the
// share of traffic that happened to land on one instance, which makes it
// easy to walk straight past.
const loginAttemptSchema = new mongoose.Schema(
  {
    // Composite key describing what is being counted — see buildKeys() in
    // middleware/loginRateLimit.js ("u:admin|ip:1.2.3.4", "u:admin", "ip:…").
    _id: { type: String, required: true },
    count: { type: Number, default: 0 },
    firstFailedAt: { type: Date },
    lastFailedAt: { type: Date },
    // Counters clean themselves up, so nothing accumulates and a lockout can
    // never outlive its window even if a request never comes back to clear it.
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false }
);

loginAttemptSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("LoginAttempt", loginAttemptSchema);
