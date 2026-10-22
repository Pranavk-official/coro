import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests",
  fullyParallel: true,
  workers: 3, // more parallel WebRTC browsers starve each other and calls flake (4 flaked share/recording tests; 3 was clean and faster)
  reporter: [["list"], ["html", { open: "never" }]],
  projects: [
    { name: "unit", testMatch: /unit\/.*\.test\.ts/ },
    {
      name: "integration",
      testMatch: /integration\/.*\.test\.ts/,
      use: { baseURL: "http://localhost:3000" },
    },
    { name: "setup", testMatch: /e2e\/auth\.setup\.ts/, use: { baseURL: "http://localhost:3000" } },
    {
      name: "e2e",
      testMatch: /e2e\/.*\.spec\.ts/,
      timeout: 60_000, // multi-context WebRTC calls; teardown alone can take seconds under load
      retries: 1, // fake-media calls are CPU-sensitive under parallel load; retried passes still show as "flaky"
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        baseURL: "http://localhost:3000",
        permissions: ["camera", "microphone"],
        launchOptions: {
          args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
        },
      },
    },
    {
      name: "showcase", // README screenshots only: `bun run screenshots` (needs SHOWCASE=1, so `bun run test` skips it)
      testMatch: process.env.SHOWCASE ? /showcase\/.*\.spec\.ts/ : /^$/,
      retries: 1, // 3 WebRTC browsers per test; same flake budget as e2e
      dependencies: ["setup"],
      use: {
        baseURL: "http://localhost:3000",
        permissions: ["camera", "microphone"],
        launchOptions: {
          args: [
            "--use-fake-ui-for-media-stream",
            "--use-fake-device-for-media-stream",
            `--use-file-for-fake-video-capture=${process.cwd()}/tests/showcase/fake-camera.y4m`, // calm gradient, not the green test card
          ],
        },
      },
    },
  ],
  webServer: {
    command: "bun run dev:test",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    env: { AUTH_TEST_LOGIN: "1", RATE_LIMIT_DISABLED: "1" }, // limiter tests run in-process (tests/integration/rate-limit*)
  },
});
