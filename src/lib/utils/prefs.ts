export type Prefs = {
  mic: boolean;
  cam: boolean;
  micId: string | null;
  camId: string | null;
  speakerId: string | null;
  guestName: string;
};

const DEFAULTS: Prefs = {
  mic: true,
  cam: true,
  micId: null,
  camId: null,
  speakerId: null,
  guestName: "",
};

const KEY = "vc-demo.prefs.v1";

function read(): Partial<Prefs> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) return {};
    return parsed as Partial<Prefs>;
  } catch {
    return {};
  }
}

export function getPrefs(): Prefs {
  const stored = read();
  return {
    mic: typeof stored.mic === "boolean" ? stored.mic : DEFAULTS.mic,
    cam: typeof stored.cam === "boolean" ? stored.cam : DEFAULTS.cam,
    micId: typeof stored.micId === "string" ? stored.micId : null,
    camId: typeof stored.camId === "string" ? stored.camId : null,
    speakerId: typeof stored.speakerId === "string" ? stored.speakerId : null,
    guestName: typeof stored.guestName === "string" ? stored.guestName : "",
  };
}

export function setPrefs(patch: Partial<Prefs>): Prefs {
  const next = { ...getPrefs(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable — prefs stay in memory for this session */
  }
  return next;
}
