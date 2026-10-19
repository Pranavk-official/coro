/**
 * Phone screen share through the Capacitor shell (spec 008). Phone browsers have no getDisplayMedia, so the
 * app's native plugin runs a share-only peer instead. The shell injects `window.Capacitor`; no web dependency.
 */
export type NativeShareStart = { origin: string; code: string; screenId: string; joinToken?: string };

type Plugin = {
  start(o: NativeShareStart): Promise<void>;
  stop(): Promise<void>;
  /** The shell returns the handle directly or as a Promise depending on bridge version: handle both. */
  addListener(
    event: "stopped",
    cb: (e: { reason?: string }) => void,
  ): Promise<{ remove(): Promise<void> }> | { remove(): Promise<void> };
};
type Shell = { isNativePlatform?: () => boolean; Plugins?: { NativeShare?: Plugin } };

const plugin = (): Plugin | null => {
  const cap = (globalThis as { Capacitor?: Shell }).Capacitor;
  return cap?.isNativePlatform?.() ? (cap.Plugins?.NativeShare ?? null) : null;
};

/** True only inside the Coro phone app with the NativeShare plugin. */
export const isNativeShare = (): boolean => plugin() !== null;

export const startNativeShare = (o: NativeShareStart) => plugin()!.start(o);
export const stopNativeShare = () => plugin()?.stop() ?? Promise.resolve();

/** Native side stopped (system stop, takeover, host, kicked, ended). Returns an unsubscribe. */
export function onNativeShareStopped(cb: (reason?: string) => void): () => void {
  const p = plugin();
  if (!p) return () => undefined;
  const sub = Promise.resolve(p.addListener("stopped", (e) => cb(e.reason)));
  return () => void sub.then((s) => s.remove());
}
