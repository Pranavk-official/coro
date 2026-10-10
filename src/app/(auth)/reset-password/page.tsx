import { Suspense } from "react";
import ResetForm from "@/components/auth/ResetForm";

export default function Page() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
