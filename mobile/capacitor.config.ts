import type { CapacitorConfig } from "@capacitor/cli";

// The app is a shell around the deployed web app (spec 008 D1): web deploys update it without a store release.
// CORO_URL: the origin to load, e.g. https://meet.example.com. Dev default: http://localhost:3000 with
// `adb reverse tcp:3000 tcp:3000`, so the origin matches BETTER_AUTH_URL and stays a secure context for getUserMedia.
const url = process.env.CORO_URL ?? "http://localhost:3000";

const config: CapacitorConfig = {
  appId: "app.coro.meet",
  appName: "Coro",
  webDir: "www",
  server: { url, cleartext: url.startsWith("http://") },
  android: { allowMixedContent: false },
};

export default config;
