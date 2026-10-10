import { Suspense } from "react";
import VerifyEmailResult from "@/components/auth/VerifyEmailResult";

export default function Page() {
  return (
    <Suspense>
      <VerifyEmailResult />
    </Suspense>
  );
}
