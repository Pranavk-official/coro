import type { ErrorCode } from "@/types/api/error";

/** `screenId`: stream id of the sender's screen share (spec 007), so peers tell screen from camera by id. `recording`: REC badge (spec 003 FR4). */
export type MediaState = { mic: boolean; cam: boolean; screen: boolean; screenId?: string; recording?: boolean };

export type Peer = {
  id: string;
  userId: string;
  name: string;
  image: string | null;
  isGuest: boolean;
  isHost: boolean;
  state: MediaState;
};

export type JoinError = Extract<
  ErrorCode,
  | "not_found"
  | "ended"
  | "expired"
  | "password_required"
  | "guests_not_allowed"
  | "locked"
  | "room_full"
  | "in_other_tab"
  | "rate_limited"
>;

export type JoinOk =
  | { ok: true; status: "admitted"; peers: Peer[]; polite: boolean; locked: boolean; canAdmit: boolean; isHost: boolean }
  | { ok: true; status: "waiting" };

/** `retryAfter` (seconds) only with `rate_limited`. */
export type JoinResult = JoinOk | { ok: false; error: JoinError; retryAfter?: number };

export type RoomPeek = { count: number; names: string[] };

export const MAX_PEERS = 10;
export const MAX_WAITING = 20;
export const READMIT_WINDOW_MS = 60_000;

export interface ClientToServerEvents {
  /** `here`: answer to `in_other_tab` — "switch" moves this user's call here, "also" keeps both sessions. */
  "room:join": (
    code: string,
    opts: { joinToken?: string; here?: "switch" | "also" },
    cb: (r: JoinResult) => void,
  ) => void;
  "room:leave": () => void;
  /** Pre-join "who's here": admitted people only, one entry per account. */
  "room:peek": (code: string, cb: (r: RoomPeek) => void) => void;
  "signal": (to: string, data: { description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit | null }) => void;
  "state": (state: MediaState) => void;
  "host:admit": (id: string) => void;
  "host:deny": (id: string) => void;
  "host:mute": (id: string) => void;
  "host:kick": (id: string) => void;
  "host:lock": (locked: boolean) => void;
  "host:end": () => void;
  /** Host stops someone's presentation (spec 007 FR7). */
  "host:stop-share": (id: string) => void;
}

export interface ServerToClientEvents {
  "peer:joined": (peer: Peer) => void;
  "peer:left": (id: string) => void;
  "peer:state": (id: string, state: MediaState) => void;
  "signal": (from: string, data: { description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit | null }) => void;
  "waiting:update": (waiting: Peer[]) => void;
  "admitted": (r: Extract<JoinOk, { status: "admitted" }>) => void;
  "denied": () => void;
  "host:muted": () => void;
  "kicked": () => void;
  /** Same user chose "Switch here" on another tab/device; this session was taken out of the call. */
  "moved": () => void;
  "room:locked": (locked: boolean) => void;
  "room:ended": () => void;
  /** A fire-and-forget event was dropped by the limiter (spec 002 FR6); `event` is the client event name. */
  "rate_limited": (event: string, retryAfter: number) => void;
  /** Stop presenting: someone else started (one presenter at a time) or the host stopped you. */
  "share:stop": (reason: "takeover" | "host") => void;
}

export type SocketUser = {
  id: string;
  name: string;
  image: string | null;
  isAnonymous: boolean;
};

export interface SocketData {
  user: SocketUser;
  room?: string;
  state: MediaState;
}
