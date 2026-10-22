import type { Metadata } from "next";
import DocPage from "@/components/docs/DocPage";
import Code from "@/components/docs/CodeBlock";
import { C, H2, Note, Shot, Step, Steps } from "@/components/docs/prose";

export const metadata: Metadata = { title: "Sign-in providers · Docs", description: "Email, Google (with Drive) and GitHub sign-in for Coro." };

export default function Page() {
  return (
    <DocPage
      href="/docs/sign-in"
    >
      <H2 id="email">Email</H2>
      <p>Any SMTP provider works: Resend, Postmark, Amazon SES, Mailgun or your own server. Use a sender on a domain you control.</p>
      <Code lang="dotenv" title=".env" code={`SMTP_URL=smtps://user:password@smtp.example.com:465\nMAIL_FROM=Coro <no-reply@example.com>`} />
      <p>Then add DNS records for that domain, or sign-in links land in spam. Your provider gives you the SPF and DKIM values; DMARC you write yourself:</p>
      <Code lang="plaintext" title="DNS (TXT records)" code={`example.com          TXT  "v=spf1 include:<your provider> ~all"\n<selector>._domainkey TXT  "<DKIM value from your provider>"\n_dmarc.example.com   TXT  "v=DMARC1; p=none; rua=mailto:you@example.com"`} />

      <H2 id="google">Google and Drive</H2>
      <Steps>
        <Step title="Branding">
          <p>
            In the{" "}
            <a href="https://console.cloud.google.com/auth/overview" target="_blank" rel="noopener noreferrer">Google Cloud console</a>,
            open <strong>Google Auth Platform → Branding</strong>: app name, logo (<C>public/brand/coro-logo-120.png</C> is the 120×120 it asks for),
            and these links. Add your domain under <strong>Authorized domains</strong>.
          </p>
          <Code lang="plaintext" title="Branding links" code={`Home page:        https://meet.example.com\nPrivacy policy:   https://meet.example.com/privacy\nTerms of service: https://meet.example.com/terms`} />
        </Step>
        <Step title="OAuth client">
          <p><strong>Clients → Create client → Web application</strong>, with:</p>
          <Code lang="plaintext" title="Authorized JavaScript origins" code={`https://meet.example.com`} />
          <Code lang="plaintext" title="Authorized redirect URIs" code={`https://meet.example.com/api/auth/callback/google`} />
        </Step>
        <Step title="Keys">
          <Code lang="dotenv" title=".env" code={`GOOGLE_CLIENT_ID=1234567890-abc.apps.googleusercontent.com\nGOOGLE_CLIENT_SECRET=GOCSPX-...`} />
          <Code code={`docker compose up -d app`} />
        </Step>
        <Step title="Google Drive (optional)">
          <p>
            <strong>APIs &amp; Services → Library → Google Drive API → Enable</strong>, and add this scope under{" "}
            <strong>Data access</strong>. Coro only ever sees files it creates.
          </p>
          <Code lang="plaintext" title="Scope" code={`https://www.googleapis.com/auth/drive.file`} />
        </Step>
        <Step title="Testing or published">
          <p>While the app is in <strong>Testing</strong>, only accounts under <strong>Audience → Test users</strong> can sign in. Publish it to open it to everyone.</p>
        </Step>
      </Steps>
      <Shot name="profile" alt="Profile page with the recordings list and the Google Drive card" caption="People connect Google Drive from their profile; their saved recordings are listed there." />

      <H2 id="github">GitHub</H2>
      <Steps>
        <Step title="Register an OAuth app">
          <p>
            <a href="https://github.com/settings/applications/new" target="_blank" rel="noopener noreferrer">GitHub → Settings → Developer settings → OAuth Apps → New</a>:
          </p>
          <Code lang="plaintext" title="OAuth app" code={`Homepage URL:               https://meet.example.com\nAuthorization callback URL: https://meet.example.com/api/auth/callback/github`} />
        </Step>
        <Step title="Keys">
          <p>Generate a client secret, then:</p>
          <Code lang="dotenv" title=".env" code={`GITHUB_CLIENT_ID=Ov23li...\nGITHUB_CLIENT_SECRET=...`} />
          <Code code={`docker compose up -d app`} />
        </Step>
      </Steps>
      <Note>Every redirect URI must match <C>BETTER_AUTH_URL</C> exactly: same scheme and host, no trailing slash.</Note>
    </DocPage>
  );
}
