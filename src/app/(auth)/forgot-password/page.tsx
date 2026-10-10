import { Suspense } from "react";
import ForgotForm from "@/components/auth/ForgotForm";

export default function Page() {
  return (
    <Suspense>
      <ForgotForm />
    </Suspense>
  );
}
