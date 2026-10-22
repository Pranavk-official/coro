import type { Metadata } from "next";
import DocPage from "@/components/docs/DocPage";
import Code from "@/components/docs/CodeBlock";
import { C, H2, Step, Steps } from "@/components/docs/prose";
import { DEPLOY } from "@/lib/docs/deploy-files";

export const metadata: Metadata = { title: "TURN relay · Docs", description: "Let callers on strict networks connect, with coturn." };

export default function Page() {
  return (
    <DocPage
      href="/docs/turn"
    >
      <H2 id="setup">Set it up</H2>
      <Steps>
        <Step title="Add three variables">
          <p>
            <C>TURN_EXTERNAL_IP</C> is <C>public/private</C> on AWS, GCP, Azure and Oracle (the VM sits behind NAT), or just
            the public IP on Hetzner, DigitalOcean and OVH.
          </p>
          <Code lang="dotenv" title=".env" code={`TURN_HOST=203.0.113.10            # public IP, or a turn.example.com A record\nTURN_SECRET=                      # openssl rand -hex 32\nTURN_EXTERNAL_IP=203.0.113.10/10.0.1.25`} />
        </Step>
        <Step title="Open the ports">
          <p>In the cloud firewall and on the server: <C>3478/udp</C>, <C>3478/tcp</C> and the relay range <C>49160–49200/udp</C>.</p>
          <Code code={`sudo ufw allow 3478\nsudo ufw allow 49160:49200/udp`} />
        </Step>
        <Step title="Start coturn, then restart the app">
          <p>The app hands out TURN credentials only once it sees the variables.</p>
          <Code code={`docker compose -f docker-compose.yml -f deploy/turn.compose.yml up -d coturn\ndocker compose up -d app`} />
        </Step>
      </Steps>

      <H2 id="file">The compose file</H2>
      <Code lang="yaml" title="deploy/turn.compose.yml" code={DEPLOY.turn()} />

      <H2 id="test">Check it works</H2>
      <p>Credentials are short-lived and signed with <C>TURN_SECRET</C>. Make a test pair on the server:</p>
      <Code code={`source .env\nuser="$(( $(date +%s) + 3600 )):test"\npass=$(printf %s "$user" | openssl dgst -binary -sha1 -hmac "$TURN_SECRET" | base64)\necho "username: $user"\necho "password: $pass"`} />
      <p>
        Open WebRTC&apos;s{" "}
        <a href="https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/" target="_blank" rel="noopener noreferrer">
          Trickle ICE
        </a>{" "}
        page, add the server below with that username and password, and press <strong>Gather candidates</strong>. A{" "}
        <C>relay</C> candidate means it works.
      </p>
      <Code lang="plaintext" title="STUN or TURN URI" code={`turn:203.0.113.10:3478`} />
    </DocPage>
  );
}
