import "server-only";

/**
 * Global (not per-IP) failure limits: behind Docker Desktop the client IP is not
 * reliable and X-Forwarded-For can be spoofed, so per-IP limits would be bypassable.
 * With a short numeric password these limits are what keeps brute force impractical.
 */
const WINDOWS = [
  { ms: 15 * 60 * 1000, max: 10 },
  { ms: 24 * 60 * 60 * 1000, max: 30 },
];
const LONGEST = Math.max(...WINDOWS.map((w) => w.ms));

const globalForLimit = globalThis as unknown as { __loginFailures?: number[] };
const failures = (globalForLimit.__loginFailures ??= []);

function prune(now: number) {
  while (failures.length && failures[0] <= now - LONGEST) failures.shift();
}

/** Returns minutes until login is allowed again, or 0 if allowed now. */
export function lockedMinutes(now = Date.now()) {
  prune(now);
  let until = 0;
  for (const w of WINDOWS) {
    const recent = failures.filter((t) => t > now - w.ms);
    if (recent.length >= w.max) {
      until = Math.max(until, recent[recent.length - w.max] + w.ms);
    }
  }
  return until > now ? Math.ceil((until - now) / 60000) : 0;
}

export function recordFailure(now = Date.now()) {
  failures.push(now);
  prune(now);
}
