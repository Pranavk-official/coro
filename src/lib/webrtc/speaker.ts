export type LevelSource = () => number;

type Track = {
  getLevel: LevelSource;
  consecutive: number;
  lastValue: number;
  lastActiveAt: number;
};

export type SpeakerDetector = {
  add(id: string, stream?: MediaStream, getLevel?: LevelSource): void;
  remove(id: string): void;
  tick(now?: number): string | null;
  current(): string | null;
  onSpeaking(cb: (id: string | null) => void): () => void;
  start(intervalMs?: number): () => void;
};

export function createSpeakerDetector(opts?: {
  threshold?: number;
  holdMs?: number;
  now?: () => number;
}): SpeakerDetector {
  const threshold = opts?.threshold ?? 0.02;
  const holdMs = opts?.holdMs ?? 600;
  const clock = opts?.now ?? (() => Date.now());
  const tracks = new Map<string, Track>();
  const listeners = new Set<(id: string | null) => void>();
  let speaking: string | null = null;
  let analyserCtx: AudioContext | null = null;

  function emit(id: string | null) {
    if (id === speaking) return;
    speaking = id;
    for (const cb of listeners) cb(id);
  }

  function analyserLevel(stream: MediaStream): LevelSource {
    if (!stream.getAudioTracks().length) return () => 0; // mic off = device released; re-added when it reopens
    if (!analyserCtx) analyserCtx = new AudioContext();
    const analyser = analyserCtx.createAnalyser();
    analyser.fftSize = 512;
    analyserCtx.createMediaStreamSource(stream).connect(analyser);
    const data = new Float32Array(analyser.fftSize);
    return () => {
      analyser.getFloatTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i]! * data[i]!;
      return Math.sqrt(sum / data.length);
    };
  }

  function tick(now = clock()): string | null {
    let loudest: string | null = null;
    let loudestValue = 0;
    for (const [id, t] of tracks) {
      const v = t.getLevel();
      t.lastValue = v;
      if (v > threshold) {
        t.consecutive += 1;
        t.lastActiveAt = now;
      } else {
        t.consecutive = 0;
      }
      if (t.consecutive >= 2 && v > loudestValue) {
        loudest = id;
        loudestValue = v;
      }
    }
    if (speaking !== null) {
      const held = tracks.get(speaking);
      if (held && now - held.lastActiveAt < holdMs) {
        return speaking;
      }
    }
    emit(loudest);
    return loudest;
  }

  const detector: SpeakerDetector = {
    add(id, stream, getLevel) {
      if (tracks.has(id)) return;
      const source = getLevel ?? (stream ? analyserLevel(stream) : () => 0);
      tracks.set(id, { getLevel: source, consecutive: 0, lastValue: 0, lastActiveAt: 0 });
    },
    remove(id) {
      tracks.delete(id);
      if (speaking === id) emit(null);
    },
    tick,
    current: () => speaking,
    onSpeaking(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    start(intervalMs = 100) {
      const timer = setInterval(() => tick(), intervalMs);
      return () => clearInterval(timer);
    },
  };
  return detector;
}

export function createAutoFollow(onFollow: (id: string) => void, delayMs = 1500) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let last: string | null = null;
  return {
    push(id: string | null) {
      if (id === null || id === last) return;
      last = id;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        onFollow(id);
      }, delayMs);
    },
    cancel() {
      if (timer) clearTimeout(timer);
      timer = null;
      last = null;
    },
  };
}
