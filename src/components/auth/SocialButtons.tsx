"use client";
import type { ReactNode } from "react";
import { Button } from "@heroui/react";
import { FcGoogle } from "react-icons/fc";
import { FaGithub } from "react-icons/fa6";
import { signIn } from "@/lib/better-auth/client";
import { usePublicConfig } from "@/hooks/use-config";

/**
 * OAuth sign-in (docs: Button "Social Buttons" — tertiary, full width, brand icon + label). Only providers this
 * deployment has keys for are shown; `divider` (the "or" line) renders only when at least one is.
 */
export default function SocialButtons({ callbackURL, divider }: { callbackURL: string; divider?: ReactNode }) {
  const { data } = usePublicConfig();
  const google = data?.providers.google ?? false;
  const github = data?.providers.github ?? false;
  if (!google && !github) return null;
  return (
    <>
      <div className="flex w-full flex-col gap-3">
        {google ? (
          <Button fullWidth size="lg" variant="tertiary" onPress={() => signIn.social({ provider: "google", callbackURL })}>
            <FcGoogle className="size-5" aria-hidden />
            Continue with Google
          </Button>
        ) : null}
        {github ? (
          <Button fullWidth size="lg" variant="tertiary" onPress={() => signIn.social({ provider: "github", callbackURL })}>
            <FaGithub className="size-5" aria-hidden />
            Continue with GitHub
          </Button>
        ) : null}
      </div>
      {divider}
    </>
  );
}
