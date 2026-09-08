import jwt from "jsonwebtoken";

// Sessions last 30 days and are renewed on activity (see requireAuth), so
// someone who keeps using the app is never signed out, while a genuinely
// idle session still expires. The old 12h window meant signing in again
// almost every visit.
export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

// Renew once the token is past its halfway point rather than on every
// request, so we're not attaching a Set-Cookie to all traffic.
const RENEW_WHEN_UNDER_SECONDS = SESSION_TTL_SECONDS / 2;

const isProd = process.env.NODE_ENV === "production";

// The frontend proxies /api through to this backend (see
// frontend/vercel.json), which makes the auth cookie first-party — so
// SameSite=Lax works everywhere. That matters: with the frontend and backend
// on separate domains the cookie is third-party, which Safari blocks
// outright and Chrome partitions, and the session silently disappears.
// Set CROSS_SITE_COOKIES=true to go back to SameSite=None for a direct
// cross-domain setup.
const crossSite = process.env.CROSS_SITE_COOKIES === "true";

export const cookieOptions = {
  httpOnly: true,
  sameSite: crossSite ? "none" : "lax",
  secure: isProd || crossSite, // SameSite=None is only honored on Secure cookies
  maxAge: SESSION_TTL_SECONDS * 1000,
};

export function issueSession(res, { username, role }) {
  const token = jwt.sign({ username, role }, process.env.JWT_SECRET, {
    expiresIn: SESSION_TTL_SECONDS,
  });
  res.cookie("token", token, cookieOptions);
}

// Extends an already-valid session if it's closer to expiry than half its
// lifetime. Returns true when a fresh cookie was issued.
export function renewSessionIfStale(res, payload) {
  const secondsLeft = payload.exp - Math.floor(Date.now() / 1000);
  if (secondsLeft >= RENEW_WHEN_UNDER_SECONDS) return false;
  issueSession(res, { username: payload.username, role: payload.role });
  return true;
}

export function clearSession(res) {
  // clearCookie only needs the identifying attributes (path/sameSite/secure);
  // maxAge is deprecated there in Express 4 and ignored in 5.
  const { maxAge, ...clearOptions } = cookieOptions;
  res.clearCookie("token", clearOptions);
}
