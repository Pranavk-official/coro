import { Suspense } from "react";
import DeleteAccountConfirm from "@/components/auth/DeleteAccountConfirm";

export default function Page() {
  return (
    <Suspense>
      <DeleteAccountConfirm />
    </Suspense>
  );
}
