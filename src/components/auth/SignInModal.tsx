"use client";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { Modal } from "@heroui/react";
import SignInForm from "@/components/auth/SignInForm";
import { glassBackdrop, glassContainer, glassDialog } from "@/components/ui/glass-overlay";

function ModalShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <Modal.Header>
        <Modal.Heading className="text-[24px] font-semibold">{title}</Modal.Heading>
      </Modal.Header>
      <Modal.Body className="flex flex-col gap-4">{children}</Modal.Body>
    </>
  );
}

/** Sign-in over the current page. `children` = the trigger (a HeroUI `Button`). Unmounts once signed in. */
export default function SignInModal({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [mount, setMount] = useState(0);
  // cacheComponents keeps a route mounted but hidden (<Activity>) after navigating away (forgot password,
  // check-email); hiding runs effect cleanups, so close here or Back reopens the modal over the page.
  // Remount too: a close while display:none never gets animationend, so the exiting dialog would linger.
  useEffect(
    () => () => {
      setOpen(false);
      setMount((n) => n + 1);
    },
    [],
  );
  return (
    <Modal key={mount} isOpen={open} onOpenChange={setOpen}>
      {children}
      <Modal.Backdrop variant="blur" className={glassBackdrop}>
        <Modal.Container placement="center" size="sm" scroll="outside" className={glassContainer}>
          <Modal.Dialog className={glassDialog}>
            <Modal.CloseTrigger />
            <Suspense>
              <SignInForm shell={ModalShell} />
            </Suspense>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
