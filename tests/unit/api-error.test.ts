import { expect, test } from "@playwright/test";
import { ApiError, apiJson, toApiError } from "../../src/lib/hono/client";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

test("U18 @regression ApiError parses envelope", async () => {
  const res = jsonResponse(403, {
    success: false,
    message: "Nope.",
    error: { code: "forbidden", details: { x: 1 } },
  });
  const err = await apiJson(res).catch((e: unknown) => e);
  expect(err).toBeInstanceOf(ApiError);
  const apiErr = err as ApiError;
  expect(apiErr.status).toBe(403);
  expect(apiErr.code).toBe("forbidden");
  expect(apiErr.message).toBe("Nope.");
  expect(apiErr.details).toEqual({ x: 1 });

  const r429 = jsonResponse(429, {
    success: false,
    message: "Slow down.",
    error: { code: "rate_limited", retryAfter: 7 },
  });
  const err429 = (await apiJson(r429).catch((e: unknown) => e)) as ApiError;
  expect(err429.retryAfter).toBe(7);

  const ok = await apiJson<{ a: number }>(jsonResponse(200, { a: 1 }));
  expect(ok).toEqual({ a: 1 });

  const html = new Response("<html>nope</html>", { status: 502 });
  const errHtml = (await apiJson(html).catch((e: unknown) => e)) as ApiError;
  expect(errHtml.code).toBe("unknown");

  expect(toApiError(new TypeError("fetch failed")).code).toBe("network_error");
  expect(toApiError(new ApiError(404, "not_found", "nf")).code).toBe("not_found");
});
