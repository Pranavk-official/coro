import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { anonymous, magicLink } from "better-auth/plugins";
import { prisma } from "@/lib/prisma/client";
import { sendMail } from "@/lib/nodemailer/client";
import * as templates from "@/lib/nodemailer/templates";
import { safeNext } from "@/lib/utils/safe-next";
import { getLimit, rateLimitDisabled, type LimitName } from "@/lib/rate-limit/config";
import { countBlocked, limit } from "@/lib/rate-limit/limit";
import { REMOTE_ADDR_HEADER } from "@/lib/rate-limit/ip";
import { cacheKey, hashIp, rl } from "@/lib/redis/keys";
import { bust } from "@/lib/redis/cache";

const baseURL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
// Playwright host/member accounts skip the inbox; every other address verifies for real (spec 001 FR17).
const autoVerify = (email: string) => process.env.AUTH_TEST_LOGIN === "1" && email.endsWith("@test.local");

// Per-IP rules for better-auth's own limiter (spec 002 §Limits); per-email ones live in server/middlewares/auth-email-limit.
const AUTH_RULES: Record<string, LimitName> = {
  "/sign-in/anonymous": "auth:anonymous",
  "/sign-in/social": "auth:social",
  "/callback/*": "auth:social",
  "/sign-in/email": "auth:email",
  "/sign-up/email": "auth:signup",
  "/sign-in/magic-link": "auth:magic:ip",
  "/magic-link/verify": "auth:magic:verify",
  "/request-password-reset": "auth:reset:ip",
  "/reset-password": "auth:reset:apply",
  "/delete-user": "auth:delete",
};
const ruleFor = (name: LimitName) => {
  const r = getLimit(name);
  return { window: r.windowSec, max: r.max };
};

/** Room codes of a user being deleted, carried from `beforeDelete` to `afterDelete`. */
const deletedRooms = new Map<string, string[]>();

export const auth = betterAuth({
  baseURL,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID ?? "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
    },
  },
  // Mail is fire-and-forget (`void`) so response timing doesn't reveal whether an account exists.
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 10,
    resetPasswordTokenExpiresIn: 1800,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => void sendMail(user.email, templates.resetPassword(url)),
    onExistingUserSignUp: async ({ user }) =>
      void sendMail(user.email, templates.accountExists(`${baseURL}/sign-in`)),
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    expiresIn: 3600,
    sendVerificationEmail: async ({ user, url }) => {
      if (!autoVerify(user.email)) void sendMail(user.email, templates.verifyEmail(url));
    },
  },
  // Delete = emailed link → our interstitial → POST with the token (scanners GET links; nothing is spent on a GET).
  user: {
    deleteUser: {
      enabled: true,
      deleteTokenExpiresIn: 3600,
      sendDeleteAccountVerification: async ({ user, token }) =>
        void sendMail(user.email, templates.deleteAccount(`${baseURL}/delete-account?token=${encodeURIComponent(token)}`)),
      // Rooms go with the user (FK cascade); drop their read-cache entries too, or old links keep resolving for a TTL.
      beforeDelete: async (user) => {
        const rooms = await prisma.room.findMany({ where: { hostId: user.id }, select: { code: true } });
        deletedRooms.set(user.id, rooms.map((r) => r.code));
      },
      afterDelete: async (user) => {
        const codes = deletedRooms.get(user.id) ?? [];
        deletedRooms.delete(user.id);
        await bust(cacheKey("rooms-list", user.id), ...codes.flatMap((c) => [cacheKey("room", c), cacheKey("room-int", c)]));
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => ({ data: { ...user, emailVerified: user.emailVerified || autoVerify(user.email) } }),
      },
    },
  },
  plugins: [
    anonymous({ generateName: () => "Guest" }),
    magicLink({
      expiresIn: 600,
      storeToken: "hashed",
      // Mail points at our interstitial, not the verify endpoint: mail scanners GET links and would burn the token.
      sendMagicLink: async ({ email, token, url }) => {
        const next = safeNext(new URL(url).searchParams.get("callbackURL"));
        const link = `${baseURL}/magic-link?token=${encodeURIComponent(token)}&next=${encodeURIComponent(next)}`;
        void sendMail(email, templates.magicLink(link));
      },
    }),
  ],
  account: { accountLinking: { enabled: true, trustedProviders: ["google", "github"] } },
  // Counters go through our Redis limiter (one atomic Lua call), so sessions/tokens stay in Postgres —
  // `secondaryStorage` would move sessions into disposable Redis too.
  rateLimit: {
    enabled: !rateLimitDisabled(),
    customRules: {
      ...Object.fromEntries(Object.entries(AUTH_RULES).map(([path, name]) => [path, ruleFor(name)])),
      // Signaling resolves every socket's session from 127.0.0.1; a per-IP cap here would throttle whole calls.
      "/get-session": false,
    },
    customStorage: {
      consume: async (key, rule) => {
        const sep = key.lastIndexOf("|"); // better-auth key = `<ip>|<path>`
        const r = await limit({ key: rl("auth", `${key.slice(sep + 1)}:${hashIp(key.slice(0, sep))}`), max: rule.max, windowSec: rule.window });
        if (!r.ok) void countBlocked(`auth${key.slice(sep + 1)}`);
        return { allowed: r.ok, retryAfter: r.ok ? null : r.resetSec };
      },
    },
  },
  advanced: {
    database: { joins: true },
    // server.ts stamps the socket address; behind a proxy (TRUST_PROXY=1) use the forwarded one.
    ipAddress: { ipAddressHeaders: process.env.TRUST_PROXY === "1" ? ["x-forwarded-for"] : [REMOTE_ADDR_HEADER] },
  },
});

export type Session = typeof auth.$Infer.Session;
