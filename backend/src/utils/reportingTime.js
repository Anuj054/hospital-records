// Money reports have to follow the hospital's local calendar day, not the
// server's. Vercel runs functions with TZ=UTC, so computing "today" with
// setHours(0,0,0,0) made the day roll over at 5:30 AM IST — payments taken
// after midnight landed in the previous day's takings.
export const TIME_ZONE = process.env.REPORT_TIME_ZONE || "Asia/Kolkata";

const dayKeyFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// "2026-09-08" for the local calendar day that `at` falls on.
export function localDayKey(at) {
  return dayKeyFormat.format(at);
}

// How far TIME_ZONE runs ahead of UTC at a given instant, in ms.
function offsetMsAt(at) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
    .formatToParts(at)
    .reduce((acc, p) => ((acc[p.type] = p.value), acc), {});

  const asIfUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24, // some locales render midnight as 24
    Number(parts.minute),
    Number(parts.second)
  );
  // formatToParts only resolves to whole seconds, so compare against a
  // second-truncated instant.
  return asIfUtc - Math.floor(at.getTime() / 1000) * 1000;
}

// The UTC instant of local midnight beginning the day `at` falls on.
// (Uses the offset in effect at `at`; exact for Asia/Kolkata, which has no
// DST, and off by at most an hour on the two DST-transition days elsewhere.)
export function startOfLocalDay(at = new Date()) {
  const midnightAsIfUtc = Date.parse(`${localDayKey(at)}T00:00:00Z`);
  return new Date(midnightAsIfUtc - offsetMsAt(at));
}

export function startOfLocalMonth(at = new Date()) {
  const [year, month] = localDayKey(at).split("-");
  const firstAsIfUtc = Date.parse(`${year}-${month}-01T00:00:00Z`);
  return new Date(firstAsIfUtc - offsetMsAt(at));
}

export function startOfLocalDaysAgo(days, at = new Date()) {
  return startOfLocalDay(new Date(startOfLocalDay(at).getTime() - days * 86400000));
}

// Local day keys for the last `count` days, oldest first, ending today.
export function recentLocalDayKeys(count, at = new Date()) {
  const keys = [];
  for (let i = count - 1; i >= 0; i--) {
    keys.push(localDayKey(new Date(at.getTime() - i * 86400000)));
  }
  return keys;
}
