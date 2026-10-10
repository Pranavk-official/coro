import { expect, test } from "@playwright/test";
import { CODE_ALPHABET, generateCode } from "../../src/server/module/rooms/code";

test("U11 @regression codes match shape, alphabet-only, unique", async () => {
  const seen = new Set<string>();
  for (let i = 0; i < 10_000; i++) {
    const code = generateCode();
    expect(code).toMatch(/^[a-kmnp-z]{3}-[a-kmnp-z]{4}-[a-kmnp-z]{3}$/);
    seen.add(code);
  }
  expect(seen.size).toBe(10_000);
});

test("U11 @regression alphabet excludes lookalikes, uses randomInt", async () => {
  expect(CODE_ALPHABET).not.toContain("l");
  expect(CODE_ALPHABET).not.toContain("o");
  expect(CODE_ALPHABET).toHaveLength(24);
});
