"use client";
import { Button, Card, CardContent, Spinner } from "@heroui/react";
import { Mic, MicOff, Video, VideoOff } from "lucide-react";
import type { MediaState } from "@/lib/socket.io/events";
import { LocalPreview } from "@/components/call/VideoTile";

export default function WaitingRoom({
  stream,
  state,
  onToggle,
  onLeave,
}: {
  stream: MediaStream | null;
  state: MediaState;
  onToggle: (patch: Partial<MediaState>) => void;
  onLeave: () => void;
}) {
  return (
    <main className="flex flex-1 items-center justify-center bg-background p-4 text-foreground">
      <Card className="w-full max-w-md rounded-card border border-hairline p-0 shadow-none">
        <CardContent className="flex flex-col items-center gap-4 p-6">
          <div className="w-full overflow-hidden rounded-card shadow-product">
            <LocalPreview stream={stream} />
          </div>
          <p className="flex items-center gap-2 text-muted">
            <Spinner size="sm" /> Waiting for someone to let you in…
          </p>
          <div className="flex items-center gap-3">
            <Button
              isIconOnly
              variant={state.mic ? "secondary" : "danger"}
              className="size-12"
              aria-label={state.mic ? "Mute microphone" : "Unmute microphone"}
              aria-pressed={state.mic}
              onPress={() => onToggle({ mic: !state.mic })}
            >
              {state.mic ? <Mic size={18} /> : <MicOff size={18} />}
            </Button>
            <Button
              isIconOnly
              variant={state.cam ? "secondary" : "danger"}
              className="size-12"
              aria-label={state.cam ? "Turn camera off" : "Turn camera on"}
              aria-pressed={state.cam}
              onPress={() => onToggle({ cam: !state.cam })}
            >
              {state.cam ? <Video size={18} /> : <VideoOff size={18} />}
            </Button>
            <Button variant="danger" className="h-12 px-5" onPress={onLeave}>
              Leave
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
