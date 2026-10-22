"use client";
import { AlertDialog, Button } from "@heroui/react";
import { Trash2 } from "lucide-react";
import { authErrorCopy, useRequestAccountDelete } from "@/hooks/use-auth";
import { glassBackdrop, glassContainer, glassDialog } from "@/components/ui/glass-overlay";

/** Profile danger zone: asks once, then emails a confirm link (nothing is deleted until it's opened). */
export default function DeleteAccountCard({ email }: { email: string }) {
  const request = useRequestAccountDelete();
  return (
    <section className="flex flex-col gap-4 rounded-[26px] bg-surface p-6 sm:p-7">
      <div>
        <h2 className="text-[19px] font-semibold tracking-tight text-danger">Delete account</h2>
        <p className="text-sm text-muted">Removes your account, your meetings and your sign-in methods for good.</p>
      </div>
      {request.isSuccess ? (
        <p role="status" className="text-sm">
          Check <strong>{email}</strong> — open the link we sent within 1 hour to finish. Nothing is deleted until then.
        </p>
      ) : (
        <AlertDialog>
          <Button variant="danger-soft" className="w-fit">
            <Trash2 size={16} aria-hidden /> Delete account
          </Button>
          <AlertDialog.Backdrop variant="blur" className={glassBackdrop}>
            <AlertDialog.Container placement="center" size="sm" className={glassContainer}>
              <AlertDialog.Dialog className={glassDialog}>
                {({ close }) => (
                  <>
                    <AlertDialog.Header>
                      <AlertDialog.Icon status="danger">
                        <Trash2 className="size-5" />
                      </AlertDialog.Icon>
                      <AlertDialog.Heading>Delete your account?</AlertDialog.Heading>
                    </AlertDialog.Header>
                    <AlertDialog.Body>
                      <p>
                        We&apos;ll email a confirmation link to <strong>{email}</strong>. Opening it deletes your account and
                        every meeting you host. Recordings on your device or Google Drive stay where they are.
                      </p>
                      {request.isError ? (
                        <p role="alert" className="mt-2 text-sm text-danger">
                          {authErrorCopy(request.error)}
                        </p>
                      ) : null}
                    </AlertDialog.Body>
                    <AlertDialog.Footer>
                      <Button variant="tertiary" onPress={close}>
                        Cancel
                      </Button>
                      <Button variant="danger" isPending={request.isPending} onPress={() => request.mutate(undefined, { onSuccess: close })}>
                        Email me the link
                      </Button>
                    </AlertDialog.Footer>
                  </>
                )}
              </AlertDialog.Dialog>
            </AlertDialog.Container>
          </AlertDialog.Backdrop>
        </AlertDialog>
      )}
    </section>
  );
}
