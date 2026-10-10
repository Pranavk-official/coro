"use client";
import { createAuthClient } from "better-auth/react";
import { anonymousClient, magicLinkClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : undefined,
  plugins: [anonymousClient(), magicLinkClient()],
});

export const { useSession, signIn, signOut, signUp } = authClient;
