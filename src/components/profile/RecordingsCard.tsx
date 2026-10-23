"use client";
import { Button, Skeleton } from "@heroui/react";
import { ExternalLink, HardDrive, Trash2 } from "lucide-react";
import { FaGoogleDrive } from "react-icons/fa6";
import { useDeleteRecording, useRecordings } from "@/hooks/use-recordings";
import Tip from "@/components/ui/Tip";

const mmss = (ms: number) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const names = (list: string[]) => (list.length > 3 ? `${list.slice(0, 3).join(", ")} +${list.length - 3}` : list.join(", "));
const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

/** Profile: every recording you saved or were in, where it went, and a way back to the Drive copy. Files are never touched here. */
export default function RecordingsCard() {
  const { data, isPending, isError } = useRecordings();
  const remove = useDeleteRecording();
  return (
    <section className="flex flex-col gap-4 rounded-[26px] bg-surface p-6 sm:p-7">
      <div className="flex items-center gap-3">
        <span aria-hidden className="flex size-12 shrink-0 rotate-[5deg] items-center justify-center rounded-2xl bg-danger text-white shadow-lg">
          <span className="size-3 rounded-full bg-white" />
        </span>
        <div className="min-w-0">
          <h2 className="text-[19px] font-semibold tracking-tight">Recordings</h2>
          <p className="text-sm text-muted">Calls you recorded or were in, and where each file was saved.</p>
        </div>
      </div>
      {isPending ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16 rounded-2xl" />
          <Skeleton className="h-16 rounded-2xl" />
        </div>
      ) : isError ? (
        <p role="alert" className="text-sm text-danger">Couldn&apos;t load your recordings. Refresh to try again.</p>
      ) : !data?.length ? (
        <p className="rounded-2xl border border-dashed border-hairline p-5 text-center text-sm text-muted">
          No recordings yet. In a call, press Record; saved recordings show up here.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-hairline">
          {data.map((r) => (
            <li key={r.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{r.roomName}</p>
                <p className="truncate text-sm text-muted">
                  {when(r.createdAt)} · {mmss(r.durationMs)} · {mb(r.bytes)}
                </p>
                {!r.isOwner ? (
                  <p className="truncate text-sm text-muted">Recorded by {r.recordedBy}</p>
                ) : r.participants.length ? (
                  <p className="truncate text-sm text-muted">With {names(r.participants)}</p>
                ) : null}
                <p className="truncate font-mono text-xs text-muted">{r.name}</p>
                <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[13px]">
                  {r.isOwner && r.destinations.includes("device") ? (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-default px-2 py-0.5">
                      <HardDrive size={12} aria-hidden /> This device
                    </span>
                  ) : null}
                  {r.driveUrl ? (
                    <a
                      href={r.driveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg bg-default px-2 py-0.5 hover:bg-foreground/10"
                    >
                      <FaGoogleDrive size={11} aria-hidden /> Open in Drive <ExternalLink size={11} aria-hidden />
                    </a>
                  ) : !r.isOwner ? (
                    <span className="text-muted">Only on {r.recordedBy}&apos;s device</span>
                  ) : null}
                </p>
              </div>
              <Tip label="Remove from this list (the file stays)">
                <Button
                  isIconOnly
                  variant="ghost"
                  size="sm"
                  aria-label={`Remove ${r.roomName} recording from the list`}
                  isPending={remove.isPending && remove.variables === r.id}
                  onPress={() => remove.mutate(r.id)}
                >
                  <Trash2 size={16} />
                </Button>
              </Tip>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted">
        Device copies are in your downloads folder under the file name shown. Removing an entry never deletes a file.
      </p>
    </section>
  );
}
