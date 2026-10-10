"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/react";
import TextInput from "@/components/ui/TextInput";
import { parseMeetingInput } from "@/lib/utils/meeting-code";

export default function MeetingInput() {
  const [value, setValue] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const router = useRouter();

  function submit() {
    setHint(null);
    const code = parseMeetingInput(value);
    if (!code) {
      setHint("That doesn't look like a meeting code");
      return;
    }
    router.push(`/rooms/${encodeURIComponent(code)}`);
  }

  return (
    <form
      className="flex flex-1 items-start gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <TextInput
        label="Code or link"
        value={value}
        onChange={setValue}
        placeholder="abc-defg-hij"
        error={hint}
        className="flex-1"
      />
      <Button type="submit" variant="secondary" size="lg" className="mt-[26px]">
        Join
      </Button>
    </form>
  );
}
