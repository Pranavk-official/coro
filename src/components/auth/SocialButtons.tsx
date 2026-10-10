"use client";
import { Button } from "@heroui/react";
import { FcGoogle } from "react-icons/fc";
import { FaGithub } from "react-icons/fa6";
import { signIn } from "@/lib/better-auth/client";

/** OAuth sign-in (docs: Button "Social Buttons" — tertiary, full width, brand icon + label). */
export default function SocialButtons({ callbackURL }: { callbackURL: string }) {
  return (
    <div className="flex w-full flex-col gap-3">
      <Button
        fullWidth
        size="lg"
        variant="tertiary"
        onPress={() => signIn.social({ provider: "google", callbackURL })}
      >
        <FcGoogle className="size-5" aria-hidden />
        Continue with Google
      </Button>
      <Button
        fullWidth
        size="lg"
        variant="tertiary"
        onPress={() => signIn.social({ provider: "github", callbackURL })}
      >
        <FaGithub className="size-5" aria-hidden />
        Continue with GitHub
      </Button>
    </div>
  );
}
