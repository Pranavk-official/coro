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
  await new Promise<void>((resolve) => {
    const t = setInterval(() => {
      if (popup.closed) {
        clearInterval(t);
        resolve();
      }
    }, 500);
  });
  return driveAccountId();
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
  const session = start.headers.get("Location");
  if (!start.ok || !session) throw new Error(`drive_start_${start.status}`);
  // shortcut: single PUT, no resume on network drop; chunk with Content-Range if large uploads fail.
  const put = await fetch(session, { method: "PUT", headers: auth, body: blob });
  if (!put.ok) throw new Error(`drive_upload_${put.status}`);
  return ((await put.json()) as { id: string }).id;
}
