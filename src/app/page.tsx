import { Suspense } from "react";
import { headers } from "next/headers";
import { getSessionCookie } from "better-auth/cookies";
import { auth } from "@/lib/better-auth/server";
import Home from "@/components/lobby/Home";

// Resolve the session on the server so the first HTML is already the landing or the lobby.
// No cookie means signed out: skip the DB read.
async function HomeGate() {
  const h = await headers();
  const session = getSessionCookie(h) ? await auth.api.getSession({ headers: h }) : null;
  const user = session?.user;
  return <Home initialName={user && !user.isAnonymous ? (user.name ?? "") : null} />;
}

export default function Page() {
  return (
    <Suspense>
      <HomeGate />
    </Suspense>
  );
}
