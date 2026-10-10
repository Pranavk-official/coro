import type { ReactNode } from "react";
import Link from "next/link";
import { Card, CardContent } from "@heroui/react";
import BrandMark from "@/components/layout/BrandMark";

export default function AuthShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center px-4 pb-10 pt-[max(env(safe-area-inset-top),2.5rem)] sm:justify-center">
      <Link href="/" className="mb-6 flex items-center gap-2 text-[21px] font-bold tracking-tight">
        <BrandMark size={28} />
        coro
      </Link>
      <Card className="w-full max-w-md rounded-card border border-hairline p-0 shadow-none">
        <CardContent className="flex flex-col gap-4 p-6 sm:p-8">
          <h1 className="text-[28px] leading-[1.14] font-semibold" tabIndex={-1}>
            {title}
          </h1>
          {children}
        </CardContent>
      </Card>
    </main>
  );
}
