"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { composeMeeting, downloadBlob, MAX_RECORDING_MS, pickMime, startRecording, type RecFormat } from "@/lib/media-recorder/recorder";
import { uploadToDrive } from "@/lib/google-drive/client";
import { notify } from "@/lib/toast";
import { useSaveRecording } from "@/hooks/use-recordings";

export type RecordOptions = { format: RecFormat; compressed: boolean; driveAccountId: string | null };

type Active = {
  stop: () => Promise<Blob>;
  release: () => void;
  opts: RecordOptions;
  startedAt: number;
  timer: ReturnType<typeof setTimeout>;
};

/** Whole-meeting recording (spec 003, device + optional Drive copy). `onChange` broadcasts the REC flag. */
/** `root`: the call's container; its <video> elements are what gets recorded. */
export function useRecorder({
  code,
  roomName,
  root,
  onChange,
}: {
  code: string;
  /** Shown in the profile's recordings list; falls back to the code. */
  roomName?: string;
  root: () => Element | null;
  onChange: (recording: boolean) => void;
}) {
  const save = useSaveRecording();
  const saveRef = useRef(save);
  const nameRef = useRef(roomName);
  useEffect(() => {
    saveRef.current = save;
    nameRef.current = roomName;
  });
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const active = useRef<Active | null>(null);
  const changeRef = useRef(onChange);
  useEffect(() => {
    changeRef.current = onChange;
  }, [onChange]);

  const stop = useCallback(async () => {
    const rec = active.current;
    if (!rec) return;
    active.current = null;
    clearTimeout(rec.timer);
    setStartedAt(null);
    setSaving(true);
    changeRef.current(false);
    const blob = await rec.stop();
    rec.release();
    const ext = rec.opts.format;
    const name = `${code}-${new Date(rec.startedAt).toISOString().replace(/[:.]/g, "-")}.${ext}`;
    downloadBlob(blob, name);
    const size = `${(blob.size / 1024 / 1024).toFixed(1)} MB`;
    // A reference for the profile page; a failure here never blocks the files themselves.
    const ref = await saveRef.current.create
      .mutateAsync({
        roomCode: code,
        roomName: nameRef.current || code,
        name,
        mimeType: blob.type || `video/${ext}`,
        bytes: blob.size,
        durationMs: Date.now() - rec.startedAt,
      })
      .catch(() => null);
    notify("rec-saved", { title: `Recording saved · ${size}`, description: "Downloaded to this device", variant: "success" }, 6000);
    if (rec.opts.driveAccountId) {
      notify("rec-drive", { title: "Uploading to Google Drive…", variant: "default" }, 60_000);
      try {
        const id = await uploadToDrive(rec.opts.driveAccountId, blob, name);
        if (ref) void saveRef.current.attachDrive.mutateAsync({ id: ref.id, driveFileId: id }).catch(() => undefined);
        notify(
          "rec-drive",
          {
            title: "Saved to Google Drive",
            description: (
              <a href={`https://drive.google.com/file/d/${id}/view`} target="_blank" rel="noopener" className="underline">
                Open in Drive
              </a>
            ),
            variant: "success",
          },
          15_000,
        );
      } catch (err) {
        notify("rec-drive", { title: `Google Drive upload failed (${(err as Error).message})`, description: "The file is still on this device.", variant: "danger" }, 15_000);
      }
    }
    setSaving(false);
  }, [code]);

  const start = useCallback(
    async (opts: RecordOptions): Promise<boolean> => {
      if (active.current) return true;
      const mime = pickMime(opts.format);
      if (!mime) {
        notify("rec-error", { title: `This browser can't record ${opts.format.toUpperCase()}`, variant: "danger" });
        return false;
      }
      const scene = root();
      if (!scene) return false;
      let capture: ReturnType<typeof composeMeeting>;
      try {
        capture = composeMeeting(scene, opts.compressed);
      } catch (err) {
        notify("rec-error", { title: "Couldn't start recording", description: (err as Error).message, variant: "danger" });
        return false;
      }
      const rec = startRecording(capture.stream, mime, opts.compressed);
      active.current = {
        ...rec,
        release: capture.release,
        opts,
        startedAt: Date.now(),
        timer: setTimeout(() => {
          notify("rec-limit", { title: "Recording stopped at the 120-minute limit.", variant: "warning" });
          void stop();
        }, MAX_RECORDING_MS),
      };
      setStartedAt(active.current.startedAt);
      changeRef.current(true);
      notify("rec-self", { title: "You're recording", variant: "default" }, 2000);
      return true;
    },
    [root, stop],
  );

  // Leaving / ended / kicked unmounts the call: still finish and save.
  useEffect(() => () => void stop(), [stop]);

  useEffect(() => {
    if (startedAt === null) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [startedAt]);

  return { recording: startedAt !== null, startedAt, saving, start, stop };
}
