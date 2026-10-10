"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent } from "@heroui/react";

export default function RoomStatus({
  title,
  body,
  actionLabel,
  onAction,
  actionHref,
  redirectHomeIn,
}: {
  title: string;
  body?: string;
  actionLabel: string;
  onAction?: () => void;
  actionHref?: string;
  /** Seconds until an automatic trip home (e.g. after the meeting ends). */
  redirectHomeIn?: number;
}) {
  const router = useRouter();
  const [left, setLeft] = useState(redirectHomeIn ?? 0);
  useEffect(() => {
    if (redirectHomeIn === undefined) return;
    if (left <= 0) {
      router.replace("/");
      return;
    }
    const t = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [left, redirectHomeIn, router]);
  const action = actionHref ? (
    <Link href={actionHref}>
      <Button variant="primary">{actionLabel}</Button>
    </Link>
  ) : (
    <Button variant="primary" onPress={onAction}>
      {actionLabel}
    </Button>
  );
  return (
    <main className="flex flex-1 items-center justify-center bg-background p-4 text-foreground">
      <Card className="w-full max-w-md rounded-card border border-hairline p-0 shadow-none">
        <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
          <h1 className="text-xl font-semibold">{title}</h1>
          {body ? <p className="text-muted">{body}</p> : null}
          {action}
          {redirectHomeIn !== undefined ? (
            <p role="status" className="text-sm text-muted">
              Going home in {left}s…
            </p>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
