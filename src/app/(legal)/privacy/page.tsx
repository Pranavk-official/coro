import type { Metadata } from "next";
import LegalPage, { CONTACT_EMAIL } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy · Coro",
  description: "What Coro collects, why, and what it never does with your data.",
};

export default function Page() {
  return (
    <LegalPage title="Privacy Policy," accent="in plain words." lede="What Coro collects, why, and what it never does with your data.">
      <p>
        Coro is a video calling app run by Pranav K (&quot;we&quot;). This page explains what we collect when you use Coro,
        why, and the choices you have. The short version: your calls go straight between browsers, recordings go to your
        own device or your own Google Drive, and we don&apos;t run ads, analytics or trackers.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account details</strong> — your name, email address and profile picture. These come from the form you fill
          in, or from Google or GitHub if you sign in with them. If you use a password, we store only a secure hash of it.
        </li>
        <li>
          <strong>Guest details</strong> — if you join without an account, the display name you type. A guest session lasts
          only for that meeting.
        </li>
        <li>
          <strong>Meetings you create</strong> — the meeting name, code, start and end times, settings (such as whether guests
          may join), and a hash of the meeting password if you set one.
        </li>
        <li>
          <strong>Recording details</strong> — when you save a recording we keep a short note of it so your profile can
          list it: the meeting name and code, file name, length, size, and the Google Drive link if you saved it there.
          Never the recording itself. Remove an entry from your profile at any time.
        </li>
        <li>
          <strong>Sign-in sessions</strong> — a session cookie, plus the IP address and browser type of each session so you
          and we can spot misuse.
        </li>
        <li>
          <strong>Short-lived technical data</strong> — IP addresses held for a few minutes in counters that stop abuse
          (rate limits), and server logs that record errors, not what you say or show.
        </li>
        <li>
          <strong>Settings on your device</strong> — your theme, camera/mic choices and recording preferences are kept in your
          browser&apos;s local storage. They never leave your device.
        </li>
      </ul>

      <h2>What we don&apos;t collect</h2>
      <ul>
        <li>
          <strong>Your audio and video.</strong> Calls are sent directly between participants&apos; browsers, encrypted with
          WebRTC (DTLS-SRTP). When a direct connection isn&apos;t possible, our relay server passes the encrypted media along
          without being able to read it. We don&apos;t record or store calls.
        </li>
        <li>
          <strong>Your recordings.</strong> When someone records, the file is made in their browser and saved to their device
          and, if they choose, their own Google Drive. It is never uploaded to our servers. Everyone in the call sees a REC
          badge while recording is on.
        </li>
        <li>No advertising, no analytics or tracking scripts, no selling or renting of your data.</li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To sign you in, run your meetings, and show your name and picture to the people you meet with.</li>
        <li>To send emails you ask for: verification, sign-in links and password resets.</li>
        <li>To keep Coro secure and working: preventing abuse, fixing errors.</li>
      </ul>

      <h2>Google user data</h2>
      <p>
        If you sign in with Google, we receive your name, email address and profile picture, and use them only for your
        account. If you connect Google Drive, Coro asks for the <strong>drive.file</strong> permission, which only lets it
        create and manage the files Coro itself saves to your Drive — it cannot see or open anything else in your Drive.
        Coro uses this permission only to upload recordings you choose to save there, directly from your browser.
      </p>
      <p>
        Coro&apos;s use and transfer of information received from Google APIs adheres to the{" "}
        <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">
          Google API Services User Data Policy
        </a>
        , including the Limited Use requirements. We don&apos;t use Google user data for advertising, don&apos;t sell it,
        don&apos;t let people read it, and don&apos;t use it to train AI models. You can disconnect Drive on your profile page
        or at{" "}
        <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">
          myaccount.google.com/permissions
        </a>
        .
      </p>

      <h2>Who else handles data</h2>
      <p>We share data only with the services needed to run Coro, and only for that purpose:</p>
      <ul>
        <li>Amazon Web Services — hosts our servers and database.</li>
        <li>Resend — delivers our emails (your email address and the message).</li>
        <li>Google and GitHub — only if you choose to sign in with them or connect Drive.</li>
      </ul>
      <p>We may also disclose data if the law requires it.</p>

      <h2>How long we keep it</h2>
      <ul>
        <li>Account and meeting details — until you delete them or your account. Deleting your account removes them right away.</li>
        <li>Sign-in sessions — until you sign out or they expire.</li>
        <li>Rate-limit counters — minutes. Error logs — a short period, then rotated out.</li>
      </ul>

      <h2>Your choices and rights</h2>
      <ul>
        <li>Delete meetings from your home page, disconnect Google Drive, or delete your whole account from your profile (we email you a link to confirm).</li>
        <li>
          Ask us for a copy of your data or to correct it by emailing{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. We&apos;ll reply within 30 days.
        </li>
        <li>Use Coro as a guest if you&apos;d rather not create an account.</li>
      </ul>

      <h2>Security</h2>
      <p>
        Connections use HTTPS, call media is encrypted end to end between browsers, and passwords are stored only as hashes.
        No system is perfectly secure, so if you find a problem, please tell us.
      </p>

      <h2>Children</h2>
      <p>Coro isn&apos;t meant for children under 13, and we don&apos;t knowingly collect their data.</p>

      <h2>Changes</h2>
      <p>If this policy changes, we&apos;ll update the date at the top. Big changes will be shown in the app.</p>

      <h2>Contact</h2>
      <p>
        Questions or requests: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </LegalPage>
  );
}
