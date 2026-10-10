import { expect, test } from "@playwright/test";
import { AUTH } from "./helpers";

test.use({ storageState: AUTH.host });

test("E17 storage health", async ({ request }) => {
  expect((await request.get("/api/storage/health")).status()).toBe(200);
});
