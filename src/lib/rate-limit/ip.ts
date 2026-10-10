/** Set by `server.ts` from the TCP socket (any client-sent value is overwritten), read when `TRUST_PROXY` is off. */
export const REMOTE_ADDR_HEADER = "x-remote-addr";

type HeaderBag = Headers | Record<string, string | string[] | undefined>;

function header(h: HeaderBag, name: string): string | undefined {
  if (h instanceof Headers) return h.get(name) ?? undefined;
  const v = h[name];
  return Array.isArray(v) ? v[0] : v;
}

/** Strips brackets/port and the IPv4-mapped prefix: `[::1]:80` → `::1`, `::ffff:1.2.3.4` → `1.2.3.4`, `1.2.3.4:80` → `1.2.3.4`. */
export function normalizeIp(raw: string): string {
  let ip = raw.trim();
  const bracket = /^\[([^\]]+)\](?::\d+)?$/.exec(ip);
  if (bracket) ip = bracket[1];
  else if (/^[\d.]+:\d+$/.test(ip)) ip = ip.slice(0, ip.lastIndexOf(":"));
  if (ip.toLowerCase().startsWith("::ffff:") && ip.includes(".")) ip = ip.slice(7);
  return ip;
}

/**
 * Client IP for limits (FR4). `X-Forwarded-For` first hop only when `TRUST_PROXY=1`
 * (otherwise anyone could pick their own bucket), else the socket address. Missing ⇒ `"unknown"`.
 */
export function clientIp(headers: HeaderBag, remoteAddress?: string): string {
  const forwarded =
    process.env.TRUST_PROXY === "1" ? header(headers, "x-forwarded-for")?.split(",")[0] : undefined;
  const raw = forwarded?.trim() || remoteAddress || header(headers, REMOTE_ADDR_HEADER) || "";
  return normalizeIp(raw) || "unknown";
}
