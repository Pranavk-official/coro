"use client";
import { Button, Card, CardContent } from "@heroui/react";

export default function LeftScreen({
  onRejoin,
  onHome,
}: {
  onRejoin: () => void;
  onHome: () => void;
}) {
  return (
    <main className="flex flex-1 items-center justify-center bg-background p-4 text-foreground">
      <Card className="w-full max-w-md rounded-card border border-hairline p-0 shadow-none">
        <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
          <h1 className="text-xl font-semibold">You left the meeting</h1>
          <div className="flex gap-2">
            <Button variant="primary" onPress={onRejoin}>
              Rejoin
            </Button>
            <Button variant="ghost" onPress={onHome}>
              Back to home
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
