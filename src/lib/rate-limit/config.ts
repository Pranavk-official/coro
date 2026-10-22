/** One row per limit (spec 002 §Limits). `failClosed`: Redis down ⇒ 503 instead of allow (FR8). */
export type LimitRule = { max: number; windowSec: number; failClosed?: boolean };

const MIN = 60;
const HOUR = 3600;

export const LIMITS = {
  "api:global": { max: 120, windowSec: MIN },
  "api:user": { max: 240, windowSec: MIN },
  "auth:anonymous": { max: 5, windowSec: 10 * MIN },
  "auth:social": { max: 20, windowSec: 10 * MIN },
  "auth:email": { max: 3, windowSec: 10 },
  "auth:password": { max: 10, windowSec: 10 * MIN, failClosed: true },
  "auth:signup": { max: 5, windowSec: HOUR },
  "auth:magic:ip": { max: 10, windowSec: HOUR },
  "auth:magic:email": { max: 3, windowSec: 10 * MIN },
  "auth:magic:verify": { max: 30, windowSec: 10 * MIN },
  "auth:reset:ip": { max: 10, windowSec: HOUR },
  "auth:reset:email": { max: 3, windowSec: HOUR },
  "auth:reset:apply": { max: 10, windowSec: HOUR },
  "auth:verify-email": { max: 3, windowSec: HOUR },
  "auth:delete": { max: 3, windowSec: HOUR },
  "mail:daily": { max: 500, windowSec: 24 * HOUR },
  "rooms:create": { max: 20, windowSec: HOUR },
  "rooms:verify": { max: 5, windowSec: 5 * MIN, failClosed: true },
  "rooms:get": { max: 60, windowSec: MIN },
  ice: { max: 30, windowSec: 10 * MIN },
  "storage:presign": { max: 60, windowSec: MIN },
  "recordings:read": { max: 60, windowSec: MIN },
  "recordings:write": { max: 30, windowSec: MIN },
  "sock:connect": { max: 30, windowSec: MIN },
  "sock:join": { max: 20, windowSec: MIN },
  "sock:signal": { max: 600, windowSec: MIN },
  "sock:state": { max: 60, windowSec: MIN },
  "sock:host": { max: 60, windowSec: MIN },
} as const satisfies Record<string, LimitRule>;

export type LimitName = keyof typeof LIMITS;

/** `rooms:verify` → `RATE_LIMIT_ROOMS_VERIFY`. */
export const envName = (name: string): string =>
  `RATE_LIMIT_${name.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;

const warned = new Set<string>();

/** Default row, overridden by `RATE_LIMIT_<NAME>=max/windowSec`. Malformed ⇒ default + one warning. */
export function getLimit(name: LimitName): LimitRule {
  const base: LimitRule = LIMITS[name];
  const key = envName(name);
  const raw = process.env[key];
  if (!raw) return base;
  const m = /^\s*(\d+)\s*\/\s*(\d+)\s*$/.exec(raw);
  if (!m || Number(m[1]) < 1 || Number(m[2]) < 1) {
    if (!warned.has(key)) {
      warned.add(key);
      console.warn(`[rate-limit] ignoring malformed ${key}="${raw}" (want max/windowSec)`);
    }
    return base;
  }
  return { ...base, max: Number(m[1]), windowSec: Number(m[2]) };
}

export const rateLimitDisabled = (): boolean => process.env.RATE_LIMIT_DISABLED === "1";
