"use client";
import { authClient } from "@/lib/better-auth/client";

export const DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";

/** better-auth account id of the Google account that granted `drive.file`, else null. */
export async function driveAccountId(): Promise<string | null> {
  const { data } = await authClient.listAccounts();
  return data?.find((a) => a.providerId === "google" && a.scopes.includes(DRIVE_FILE_SCOPE))?.id ?? null;
}

/**
 * Google consent in a popup: a redirect would tear down the call (and any recording in memory).
 * Resolves the account id once the popup closes with the scope granted.
 */
export async function connectDrive(): Promise<string | null> {
  const popup = window.open("", "drive-connect", "width=520,height=640");
  const { data, error } = await authClient.linkSocial({
    provider: "google",
    scopes: [DRIVE_FILE_SCOPE],
    additionalParams: { access_type: "offline", prompt: "consent" },
    callbackURL: "/linked",
    errorCallbackURL: "/linked",
    disableRedirect: true,
  });
  if (error || !data?.url || !popup) {
    popup?.close();
    return null;
  }
  popup.location.href = data.url;
  // No `popup.closed` polling: Google's pages set COOP, so every poll logs a warning while they're open.
  // /linked announces itself on a BroadcastChannel; a user who just closes the popup brings focus back here.
  await new Promise<void>((resolve) => {
    const channel = new BroadcastChannel(LINKED_CHANNEL);
    const done = () => {
      channel.close();
      window.removeEventListener("focus", onFocus);
      resolve();
    };
    const onFocus = () => {
      if (popup.closed) done();
    };
    channel.onmessage = done;
    window.addEventListener("focus", onFocus);
  });
  return driveAccountId();
}

export const LINKED_CHANNEL = "coro-drive-linked";

/** Google's reason for a failed Drive call, in words the user can act on. */
async function driveError(res: Response, step: string): Promise<Error> {
  const body = (await res.json().catch(() => null)) as { error?: { message?: string; errors?: { reason?: string }[] } } | null;
  const reason = body?.error?.errors?.[0]?.reason ?? "";
  const known: Record<string, string> = {
    accessNotConfigured: "the Google Drive API isn't enabled for this app's Google Cloud project",
    insufficientPermissions: "Drive access wasn't granted. Reconnect Google Drive on your profile",
    ACCESS_TOKEN_SCOPE_INSUFFICIENT: "Drive access wasn't granted. Reconnect Google Drive on your profile",
    storageQuotaExceeded: "your Google Drive is full",
    userRateLimitExceeded: "Google is rate limiting uploads. Try again in a minute",
  };
  console.error(`[drive] ${step} ${res.status}`, reason, body?.error?.message);
  return new Error(known[reason] ?? body?.error?.message ?? `drive_${step}_${res.status}`);
}

/** Resumable session + one PUT of the whole file; returns the Drive file id. */
export async function uploadToDrive(accountId: string, blob: Blob, name: string): Promise<string> {
  const { data, error } = await authClient.getAccessToken({ accountId });
  if (error || !data?.accessToken) throw new Error("drive_token");
  const auth = { Authorization: `Bearer ${data.accessToken}` };
  const start = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable", {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Type": blob.type },
    body: JSON.stringify({ name, mimeType: blob.type }),
  });
  if (!start.ok) throw await driveError(start, "start");
  const session = start.headers.get("Location");
  if (!session) throw new Error("drive_start_no_session");
  // shortcut: single PUT, no resume on network drop; chunk with Content-Range if large uploads fail.
  const put = await fetch(session, { method: "PUT", headers: auth, body: blob });
  if (!put.ok) throw await driveError(put, "upload");
  return ((await put.json()) as { id: string }).id;
}
