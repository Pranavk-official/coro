import { expect, test } from "@playwright/test";
import { shareDriveFile } from "../../src/lib/google-drive/server";

test("U21 @regression shareDriveFile: one reader permission per email, failures returned not thrown", async () => {
  const calls: { url: string; body: unknown; auth: string | null }[] = [];
  const fetcher = (async (url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as { emailAddress: string };
    calls.push({ url, body, auth: new Headers(init.headers).get("Authorization") });
    if (body.emailAddress === "down@x.test") throw new Error("network");
    return new Response("{}", { status: body.emailAddress === "bad@x.test" ? 400 : 200 });
  }) as typeof fetch;
  const failed = await shareDriveFile("tok", "file 1", ["a@x.test", "bad@x.test", "down@x.test"], fetcher);
  expect(failed).toEqual(["bad@x.test", "down@x.test"]);
  expect(calls).toHaveLength(3);
  expect(calls[0]).toEqual({
    url: "https://www.googleapis.com/drive/v3/files/file%201/permissions",
    body: { role: "reader", type: "user", emailAddress: "a@x.test" },
    auth: "Bearer tok",
  });
});
