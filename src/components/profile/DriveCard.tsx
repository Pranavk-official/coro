"use client";
import { Button, Spinner } from "@heroui/react";
import { FaGoogleDrive } from "react-icons/fa6";
import { useConnectDrive, useDisconnectDrive, useDriveAccount } from "@/hooks/use-drive";

const UNLINK_COPY: Record<string, string> = {
  FAILED_TO_UNLINK_LAST_ACCOUNT:
    "Google is your only way to sign in, so it can't be removed here. Add a password or GitHub first, or remove access in your Google account.",
  SESSION_NOT_FRESH: "Sign out and back in, then try again.",
};

/** Profile: connect Google Drive once; recordings can then also save there (spec 003). */
export default function DriveCard() {
  const account = useDriveAccount();
  const connect = useConnectDrive();
  const disconnect = useDisconnectDrive();
  const id = account.data ?? null;
  const error = connect.error
    ? "Google didn't connect. Try again."
    : disconnect.error
      ? (UNLINK_COPY[disconnect.error.message] ?? "Couldn't disconnect. Try again.")
      : null;

  return (
    <section className="flex flex-col gap-4 rounded-[26px] bg-surface p-6 sm:p-7">
      <div className="flex items-center gap-3">
        <span aria-hidden className="flex size-12 shrink-0 rotate-[-6deg] items-center justify-center rounded-2xl bg-[#30b0a0] text-white shadow-lg">
          <FaGoogleDrive size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[19px] font-semibold tracking-tight">Google Drive</h2>
          <p className="text-sm text-muted">
            {account.isPending ? "Checking…" : id ? "Connected. Recordings can save to your Drive." : "Save recordings straight to your Drive."}
          </p>
        </div>
        {account.isPending ? (
          <Spinner size="sm" />
        ) : id ? (
          <Button variant="secondary" isPending={disconnect.isPending} onPress={() => disconnect.mutate(id)}>
            Disconnect
          </Button>
        ) : (
          <Button variant="primary" isPending={connect.isPending} onPress={() => connect.mutate()}>
            Connect
          </Button>
        )}
      </div>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}{" "}
          {disconnect.error?.message === "FAILED_TO_UNLINK_LAST_ACCOUNT" ? (
            <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="text-link underline">
              Open Google settings
            </a>
          ) : null}
        </p>
      ) : null}
      <p className="text-xs text-muted">Coro only sees files it creates (Drive &quot;drive.file&quot; access), never the rest of your Drive.</p>
    </section>
  );
}
