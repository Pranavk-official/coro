import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, { CONTACT_EMAIL } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Service · Coro",
  description: "The rules for using Coro.",
};

export default function Page() {
  return (
    <LegalPage title="Terms of Service," accent="kept short." lede="The few rules for using Coro, and what we can and can't promise.">
      <p>
        These terms apply when you use Coro, a video calling app run by Pranav K (&quot;we&quot;). By using Coro you agree to
        them. If you don&apos;t agree, please don&apos;t use it.
      </p>

      <h2>The service</h2>
      <p>
        Coro lets you create and join video meetings, share your screen, and record calls to your own device or Google Drive.
        It&apos;s free and provided as is. We may change, pause or stop features at any time, and meetings end when their
        time runs out or the host ends them.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>Give accurate details and keep your sign-in secure. You&apos;re responsible for what happens under your account.</li>
        <li>Guests can join meetings that allow them, using only a display name.</li>
        <li>You must be at least 13 years old to use Coro.</li>
      </ul>

      <h2>Acceptable use</h2>
      <p>Don&apos;t use Coro to:</p>
      <ul>
        <li>break the law, or share content that is illegal, sexually exploits anyone, or promotes violence;</li>
        <li>harass, threaten, impersonate or deceive people;</li>
        <li>join meetings you weren&apos;t invited to, or get around a host&apos;s lock, password or removal;</li>
        <li>attack, overload, scrape or probe Coro or its users, or get around rate limits;</li>
        <li>infringe anyone&apos;s copyright, privacy or other rights.</li>
      </ul>

      <h2>Recording</h2>
      <p>
        Coro shows everyone a REC badge while a call is recorded, but you are responsible for getting any consent the law
        requires before you record people, and for how you use and share recordings.
      </p>

      <h2>Your content</h2>
      <p>
        What you say, show and record in Coro stays yours. We don&apos;t claim ownership, and calls aren&apos;t stored on our
        servers. How we handle data is explained in the <Link href="/privacy">Privacy Policy</Link>.
      </p>

      <h2>Other services</h2>
      <p>
        Signing in with Google or GitHub and saving to Google Drive also fall under those companies&apos; own terms. We
        aren&apos;t responsible for their services.
      </p>

      <h2>Ending your use</h2>
      <p>
        You can stop using Coro at any time and delete your account from your profile. Hosts can remove people from their meetings,
        and we may suspend accounts or block access that breaks these terms or puts others at risk.
      </p>

      <h2>No warranty</h2>
      <p>
        Coro is provided &quot;as is&quot; and &quot;as available&quot;, without warranties of any kind. We don&apos;t promise
        it will always be available, error-free, or that calls or recordings won&apos;t be interrupted or lost. Keep your own
        copies of anything important.
      </p>

      <h2>Limit of liability</h2>
      <p>
        To the extent the law allows, we aren&apos;t liable for indirect or consequential losses, or for lost data, profits or
        recordings, arising from your use of Coro. Nothing here limits rights you have that the law doesn&apos;t allow us to
        limit.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these terms. The date at the top shows the latest version, and continuing to use Coro means you accept
        it.
      </p>

      <h2>Contact</h2>
      <p>
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </p>
    </LegalPage>
  );
}
