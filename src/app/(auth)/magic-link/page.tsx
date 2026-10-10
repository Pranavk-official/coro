import { Suspense } from "react";
import MagicLinkContinue from "@/components/auth/MagicLinkContinue";

export default function Page() {
  return (
    <Suspense>
      <MagicLinkContinue />
    </Suspense>
  );
}
