import { expect, test } from "@playwright/test";
import { ERROR_CODES, errorCopy, fieldErrors } from "../../src/lib/utils/error-copy";

test("U19 @regression every ErrorCode has copy, unknown falls back", async () => {
  expect(ERROR_CODES.length).toBeGreaterThan(15);
  for (const code of ERROR_CODES) {
    const copy = errorCopy(code);
    expect(typeof copy).toBe("string");
    expect(copy.length).toBeGreaterThan(0);
    expect(copy).not.toContain("{");
  }
  expect(errorCopy("no_such_code")).toBe("Something went wrong. Try again.");
  expect(errorCopy("room_full")).toContain("10/10");
});

test("U19 field mapper turns zod issues into field errors", async () => {
  expect(
    fieldErrors([
      { path: ["name"], message: "Required" },
      { path: ["address", "zip"], message: "Too short" },
      { path: [], message: "Form error" },
    ]),
  ).toEqual({ name: "Required", "address.zip": "Too short" });
  expect(fieldErrors(null)).toEqual({});
});
