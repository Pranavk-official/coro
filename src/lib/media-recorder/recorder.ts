export type RecFormat = "webm" | "mp4";

const MIMES: Record<RecFormat, string[]> = {
  webm: ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"],
  mp4: ["video/mp4;codecs=avc1,mp4a.40.2", "video/mp4"],
};

/** First container/codec this browser can record for `format`, or "" when none. */
export function pickMime(format: RecFormat, isSupported = (t: string) => MediaRecorder.isTypeSupported(t)): string {
  return MIMES[format].find(isSupported) ?? "";
}

export const MAX_RECORDING_MS = 120 * 60_000;

export type Rect = { x: number; y: number; w: number; h: number };

/** Tile rects for `n` people on a `W`×`H` canvas; with a screen share it gets the left 3/4, people stack on the right. */
export function layout(n: number, screen: boolean, W: number, H: number, gap = 8): { screen: Rect | null; tiles: Rect[] } {
  if (screen) {
    const cw = n > 0 ? W / 4 - gap : 0; // people column width
    const h = (H - gap * (n + 1)) / Math.max(n, 1);
    return {
      screen: { x: gap, y: gap, w: W - gap * 2 - (n > 0 ? cw + gap : 0), h: H - gap * 2 },
      tiles: Array.from({ length: n }, (_, i) => ({ x: W - gap - cw, y: gap + i * (h + gap), w: cw, h })),
    };
  }
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const w = (W - gap * (cols + 1)) / cols;
  const h = (H - gap * (rows + 1)) / rows;
  return {
    screen: null,
    tiles: Array.from({ length: n }, (_, i) => ({ x: gap + (i % cols) * (w + gap), y: gap + Math.floor(i / cols) * (h + gap), w, h })),
  };
}

/** Frame clock in a worker: page timers drop to 1 Hz in background tabs, worker timers don't. */
function workerClock(fps: number, tick: () => void): () => void {
  const url = URL.createObjectURL(new Blob([`setInterval(() => postMessage(0), ${Math.round(1000 / fps)})`], { type: "text/javascript" }));
  const worker = new Worker(url);
  worker.onmessage = tick;
  return () => {
    worker.terminate();
    URL.revokeObjectURL(url);
  };
}

const nameOf = (el: HTMLVideoElement) => {
  const label = el.getAttribute("aria-label") ?? "";
  if (label === "Your preview") return "You";
  return label.replace(/^Your screen preview$/, "Your screen").replace(/'s video$/, "");
};
const isScreen = (el: HTMLVideoElement) => /screen/.test(el.getAttribute("aria-label") ?? "");
const showsPicture = (el: HTMLVideoElement) => {
  const track = (el.srcObject as MediaStream | null)?.getVideoTracks()[0];
  return !!track?.enabled && track.readyState === "live" && el.videoWidth > 0 && !el.classList.contains("invisible");
};

/**
 * Loom-style: no capture prompt. Composites the call's own <video> elements (everyone's camera, screen
 * shares, our preview) onto a canvas and mixes every audio track they carry (incl. our mic).
 * People joining/leaving mid-recording are picked up on the next frame.
 */
export function composeMeeting(root: ParentNode, compressed: boolean) {
  const [W, H, fps] = compressed ? [1280, 720, 15] : [1920, 1080, 30];
  const canvas = Object.assign(document.createElement("canvas"), { width: W, height: H });
  const g = canvas.getContext("2d")!;
  const ctx = new AudioContext();
  void ctx.resume();
  const out = ctx.createMediaStreamDestination();
  const mixed = new Map<string, MediaStreamAudioSourceNode>();

  function syncAudio(videos: HTMLVideoElement[]) {
    const live = new Set<string>();
    for (const t of videos.flatMap((v) => (v.srcObject as MediaStream | null)?.getAudioTracks() ?? [])) {
      live.add(t.id);
      if (!mixed.has(t.id)) {
        const node = ctx.createMediaStreamSource(new MediaStream([t]));
        node.connect(out);
        mixed.set(t.id, node);
      }
    }
    for (const [id, node] of mixed) {
      if (!live.has(id)) {
        node.disconnect();
        mixed.delete(id);
      }
    }
  }

  // Screen shares on Linux/Wayland arrive as PipeWire GPU buffers that drawImage(<video>) paints black;
  // ImageCapture.grabFrame() hands back a plain bitmap. Static screens send no new frames: keep the last one.
  type Grabber = { grabFrame(): Promise<ImageBitmap> }; // Chromium-only, not in TS's DOM lib
  const grabs = new Map<string, { cap: Grabber; frame: ImageBitmap | null; busy: boolean }>();
  function screenFrame(el: HTMLVideoElement): ImageBitmap | null {
    const track = (el.srcObject as MediaStream | null)?.getVideoTracks()[0];
    if (!track || typeof ImageCapture === "undefined") return null;
    let grab = grabs.get(track.id);
    if (!grab) grabs.set(track.id, (grab = { cap: new ImageCapture(track) as unknown as Grabber, frame: null, busy: false }));
    const g2 = grab;
    if (!g2.busy) {
      g2.busy = true;
      g2.cap
        .grabFrame()
        .then((bitmap) => {
          g2.frame?.close();
          g2.frame = bitmap;
        })
        .catch(() => undefined)
        .finally(() => (g2.busy = false));
    }
    return g2.frame;
  }

  function drawTile(el: HTMLVideoElement, r: Rect, fit: "cover" | "contain", image: CanvasImageSource & { width: number; height: number } | null = null) {
    g.save();
    g.beginPath();
    g.roundRect(r.x, r.y, r.w, r.h, 16);
    g.clip();
    g.fillStyle = "#1c1c1e";
    g.fillRect(r.x, r.y, r.w, r.h);
    if (showsPicture(el)) {
      const [src, sw, sh] = image ? [image, image.width, image.height] : [el, el.videoWidth, el.videoHeight];
      const scale = (fit === "cover" ? Math.max : Math.min)(r.w / sw, r.h / sh);
      const w = sw * scale;
      const h = sh * scale;
      g.drawImage(src, r.x + (r.w - w) / 2, r.y + (r.h - h) / 2, w, h);
    } else {
      g.fillStyle = "#3a3a3c";
      g.beginPath();
      g.arc(r.x + r.w / 2, r.y + r.h / 2, Math.min(r.w, r.h) / 6, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#fff";
      g.font = `600 ${Math.round(Math.min(r.w, r.h) / 8)}px system-ui, sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(nameOf(el).slice(0, 1).toUpperCase(), r.x + r.w / 2, r.y + r.h / 2);
    }
    g.font = `600 ${Math.round(H / 40)}px system-ui, sans-serif`;
    g.textAlign = "left";
    g.textBaseline = "alphabetic";
    g.fillStyle = "rgb(0 0 0 / 0.55)";
    const label = nameOf(el);
    const pad = H / 90;
    const lw = g.measureText(label).width + pad * 2;
    g.beginPath();
    g.roundRect(r.x + pad, r.y + r.h - pad - H / 26, lw, H / 26, H / 52);
    g.fill();
    g.fillStyle = "#fff";
    g.fillText(label, r.x + pad * 2, r.y + r.h - pad - H / 90);
    g.restore();
  }

  const stopClock = workerClock(fps, () => {
    const videos = [...root.querySelectorAll<HTMLVideoElement>("video")];
    syncAudio(videos);
    const screen = videos.find((v) => isScreen(v) && showsPicture(v)) ?? null;
    const people = videos.filter((v) => !isScreen(v));
    const rects = layout(people.length, screen !== null, W, H);
    g.fillStyle = "#0b0b0c";
    g.fillRect(0, 0, W, H);
    if (screen && rects.screen) drawTile(screen, rects.screen, "contain", screenFrame(screen));
    people.forEach((v, i) => drawTile(v, rects.tiles[i]!, "cover"));
  });

  const stream = new MediaStream([...canvas.captureStream(fps).getVideoTracks(), ...out.stream.getAudioTracks()]);
  const release = () => {
    stopClock();
    for (const { frame } of grabs.values()) frame?.close();
    stream.getTracks().forEach((t) => t.stop());
    void ctx.close();
  };
  return { stream, release };
}

export function startRecording(stream: MediaStream, mimeType: string, compressed: boolean) {
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: compressed ? 800_000 : 4_000_000,
    audioBitsPerSecond: compressed ? 64_000 : 128_000,
  });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  const done = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType.split(";")[0] }));
  });
  // shortcut: whole file buffered in memory (~0.5 GB/h uncompressed), stream to disk/Drive if long calls matter.
  recorder.start(5000);
  return {
    stop: () => {
      if (recorder.state !== "inactive") recorder.stop();
      return done;
    },
  };
}

export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
