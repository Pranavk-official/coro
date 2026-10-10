import { Suspense } from "react";
import CheckEmail from "@/components/auth/CheckEmail";

export default function Page() {
  return (
    <Suspense>
      <CheckEmail />
    </Suspense>
  );
}
