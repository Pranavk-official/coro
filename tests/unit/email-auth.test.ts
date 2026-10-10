import { expect, test } from "@playwright/test";
import { safeNext } from "@/lib/utils/safe-next";
import * as templates from "@/lib/nodemailer/templates";
import { extractLink } from "../e2e/mail";

test("U13 @regression safeNext keeps same-origin paths only", () => {
  expect(safeNext("/a?b=1")).toBe("/a?b=1");
  expect(safeNext("/rooms/abc-defg-hij")).toBe("/rooms/abc-defg-hij");
  for (const bad of ["//evil.com", "/\\evil.com", "https://x", "javascript:alert(1)", "", "a/b", "/\nx", null, undefined, 42]) {
    expect(safeNext(bad)).toBe("/");
  }
});

test("U11 @regression templates have subject, link in text + html, escaped html", () => {
  const url = 'http://localhost:3000/x?token=a&b="<c>"';
  for (const make of [templates.magicLink, templates.verifyEmail, templates.resetPassword, templates.accountExists]) {
    const m = make(url);
    expect(m.subject.length).toBeGreaterThan(0);
    expect(m.text).toContain(url);
    expect(m.html).toContain("token=a&amp;b=&quot;&lt;c&gt;&quot;");
    expect(m.html).not.toContain('"<c>"');
  }
});

test("U14 extractLink finds the first absolute link", () => {
  expect(extractLink("Sign in: http://localhost:3000/magic-link?token=a&next=%2F\nmore http://b")).toBe(
    "http://localhost:3000/magic-link?token=a&next=%2F",
  );
  expect(extractLink("no link here")).toBeNull();
});
