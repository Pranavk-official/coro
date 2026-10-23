/** Server-side Drive calls (the recorder's token never reaches other participants). */

/**
 * Gives each email read access to a file the app created (`drive.file` allows that).
 * Google emails each person a link; that notice is also what lets non-Google addresses open it.
 * Returns the emails that failed, so one bad address never blocks the rest.
 */
export async function shareDriveFile(
  accessToken: string,
  fileId: string,
  emails: string[],
  fetcher: typeof fetch = fetch,
): Promise<string[]> {
  const failed: string[] = [];
  for (const emailAddress of emails) {
    const res = await fetcher(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/permissions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ role: "reader", type: "user", emailAddress }),
    }).catch(() => null);
    if (!res?.ok) failed.push(emailAddress);
  }
  return failed;
}
