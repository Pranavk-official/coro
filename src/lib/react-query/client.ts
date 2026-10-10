"use client";
import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { toApiError } from "@/lib/hono/client";
import { notify } from "@/lib/toast";
import { errorCopy } from "@/lib/utils/error-copy";
import { retryDelay, shouldRetry } from "@/hooks/query-config";
import { notifyRateLimited } from "@/components/providers/RateLimitToast";

export function createQueryClient(): QueryClient {
  return new QueryClient({
    // Global fallback (spec 001 FR36): screens own their 4xx copy; only server/network failures toast here.
    // 429 from anywhere → one deduped countdown toast (spec 002 FR10).
    queryCache: new QueryCache({
      onError: (err) => {
        notifyRateLimited(err);
        const e = toApiError(err);
        if (e.status >= 500 || e.code === "network_error") {
          notify("server-error", { title: errorCopy("internal_error"), variant: "danger" });
        }
      },
    }),
    mutationCache: new MutationCache({ onError: notifyRateLimited }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: shouldRetry,
        retryDelay,
        refetchOnWindowFocus: false, // focus refetches only churn limits (design §2)
      },
      mutations: { retry: false },
    },
  });
}
