import LoginAttempt from "../models/LoginAttempt.js";

const WINDOW_MS = 15 * 60 * 1000;

// Three overlapping buckets, cheapest-to-trip first:
//
//  - username+IP  one person fat-fingering their own password. Generous,
//                 and because it's scoped to the attacker's own address it
//                 can't be used to lock the real admin out.
//  - username     someone rotating IPs against one account. A hard stop,
//                 but it expires on its own, so the worst case for the
//                 real user is waiting out the window rather than being
//                 locked out for good.
//  - IP           someone spraying many usernames from one address.
//
// The numbers are deliberately loose for a human and hopeless for a script:
// 20 tries per 15 minutes is ~1,900/day against a password that needs
// billions of guesses.
const LIMITS = [
  { scope: "userIp", max: 8 },
  { scope: "user", max: 20 },
  { scope: "ip", max: 30 },
];

// Vercel's edge sets x-vercel-forwarded-for itself, so unlike
// x-forwarded-for (whose leftmost entry is whatever the client claimed) it
// can't be spoofed. Fall back through the trailing — proxy-appended, so
// also unspoofable — entry of x-forwarded-for, then the socket.
export function clientIp(req) {
  const vercel = req.headers["x-vercel-forwarded-for"];
  if (vercel) return String(vercel).split(",")[0].trim();

  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const hops = String(forwarded)
      .split(",")
      .map((h) => h.trim())
      .filter(Boolean);
    if (hops.length) return hops[hops.length - 1];
  }

  return req.socket?.remoteAddress || "unknown";
}

function buildKeys(username, ip) {
  const user = String(username || "").toLowerCase();
  return {
    userIp: `u:${user}|ip:${ip}`,
    user: `u:${user}`,
    ip: `ip:${ip}`,
  };
}

// Blocks the request when any bucket is already over its limit. Runs before
// the password is ever checked, so a locked-out caller learns nothing about
// whether the credentials were right.
export async function checkLoginRateLimit(req, res, next) {
  const { username } = req.body || {};
  if (!username) return next(); // let the controller return its 400

  const ip = clientIp(req);
  const keys = buildKeys(username, ip);

  // One round trip for all three buckets.
  const docs = await LoginAttempt.find({ _id: { $in: Object.values(keys) } }).lean();
  const byId = new Map(docs.map((d) => [d._id, d]));
  const now = Date.now();

  for (const { scope, max } of LIMITS) {
    const doc = byId.get(keys[scope]);
    if (!doc || doc.count < max) continue;
    if (doc.expiresAt.getTime() <= now) continue; // window already lapsed

    const retryAfterSeconds = Math.ceil((doc.expiresAt.getTime() - now) / 1000);
    res.set("Retry-After", String(retryAfterSeconds));
    return res.status(429).json({
      message: `Too many failed login attempts. Try again in ${Math.ceil(
        retryAfterSeconds / 60
      )} minute(s).`,
    });
  }

  req.loginRateLimitKeys = keys;
  next();
}

export async function recordLoginFailure(req) {
  const keys = req.loginRateLimitKeys || buildKeys(req.body?.username, clientIp(req));
  const now = new Date();
  const expiresAt = new Date(now.getTime() + WINDOW_MS);

  // Each bucket's window starts at its first failure and is not extended by
  // later ones, so a bucket can't be kept alive indefinitely.
  await LoginAttempt.bulkWrite(
    Object.values(keys).map((_id) => ({
      updateOne: {
        filter: { _id },
        update: {
          $inc: { count: 1 },
          $set: { lastFailedAt: now },
          $setOnInsert: { firstFailedAt: now, expiresAt },
        },
        upsert: true,
      },
    })),
    { ordered: false }
  );
}

// A correct password clears the account-scoped counters, so a legitimate
// user who mistyped a few times starts clean. The IP bucket is left alone —
// one valid login shouldn't reset someone who is spraying usernames.
export async function clearLoginFailures(req) {
  const keys = req.loginRateLimitKeys || buildKeys(req.body?.username, clientIp(req));
  await LoginAttempt.deleteMany({ _id: { $in: [keys.userIp, keys.user] } });
}
