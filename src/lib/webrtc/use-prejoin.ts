"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { getPrefs, setPrefs } from "@/lib/utils/prefs";
import {
  getStream,
  listDevices,
  onDeviceChange,
  setSpeaker,
  switchTrack,
  type DeviceInfo,
} from "@/lib/webrtc/devices";

export function usePrejoin() {
  const [prefs, setPrefsState] = useState(getPrefs);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false); // camera/mic request settled (stream or blocked)
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [level, setLevel] = useState(0);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<{ analyser: AnalyserNode; data: Float32Array } | null>(null);

  const patch = useCallback((p: Partial<{ mic: boolean; cam: boolean; micId: string | null; camId: string | null; speakerId: string | null; guestName: string }>) => {
    setPrefsState((prev) => {
      const next = { ...prev, ...p };
      setPrefs(p);
      return next;
    });
  }, []);

  const refreshDevices = useCallback(async () => {
    setDevices(await listDevices());
  }, []);

  useEffect(() => {
    let live = true;
    const p = getPrefs();
    // Always capture both and apply the saved on/off as track.enabled: "off" stays toggleable in the call
    // without a second permission prompt, and both-off isn't misreported as "blocked".
    void getStream({ mic: true, cam: true, micId: p.micId, camId: p.camId }).catch(() => null).then((s) => {
      if (!live) {
        s?.getTracks().forEach((t) => t.stop());
        return;
      }
      s?.getAudioTracks().forEach((t) => (t.enabled = p.mic));
      s?.getVideoTracks().forEach((t) => (t.enabled = p.cam));
      streamRef.current = s;
      setStream(s);
      setReady(true);
      if (!s) setError("Camera or microphone blocked. Allow access in your browser and reload.");
    });
    void refreshDevicesOnMount();
    const off = onDeviceChange(() => void refreshDevices());
    return () => {
      live = false;
      off();
    };
    async function refreshDevicesOnMount(): Promise<void> {
      if (!live) return;
      await refreshDevices();
    }
  }, [refreshDevices]);

  useEffect(() => {
    const s = streamRef.current;
    if (!s || s.getAudioTracks().length === 0) return;
    try {
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      ctx.createMediaStreamSource(s).connect(analyser);
      const data = new Float32Array(analyser.fftSize);
      analyserRef.current = { analyser, data };
      const timer = setInterval(() => {
        analyser.getFloatTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i]! * data[i]!;
        setLevel(Math.min(1, Math.sqrt(sum / data.length) * 4));
      }, 100);
      return () => {
        clearInterval(timer);
        void ctx.close().catch(() => undefined);
        analyserRef.current = null;
      };
    } catch {
      return;
    }
  }, [stream]);

  const setMic = useCallback(
    (v: boolean) => {
      streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = v));
      patch({ mic: v });
    },
    [patch],
  );

  const setCam = useCallback(
    (v: boolean) => {
      streamRef.current?.getVideoTracks().forEach((t) => (t.enabled = v));
      patch({ cam: v });
    },
    [patch],
  );

  const selectDevice = useCallback(
    async (kind: "audio" | "video" | "speaker", deviceId: string) => {
      if (kind === "speaker") {
        patch({ speakerId: deviceId });
        return;
      }
      const s = streamRef.current;
      if (!s) {
        patch(kind === "audio" ? { micId: deviceId } : { camId: deviceId });
        return;
      }
      const track = await switchTrack(s, kind, deviceId);
      if (track) {
        patch(kind === "audio" ? { micId: deviceId } : { camId: deviceId });
        await refreshDevices();
      }
    },
    [patch, refreshDevices],
  );

  const previewSpeaker = useCallback(
    (el: HTMLVideoElement | null) => {
      if (el && prefs.speakerId) setSpeaker(el, prefs.speakerId);
    },
    [prefs.speakerId],
  );

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStream(null);
  }, []);

  return {
    prefs,
    stream,
    ready,
    error,
    devices,
    level,
    setMic,
    setCam,
    selectDevice,
    previewSpeaker,
    stop,
    join: () => ({
      stream: streamRef.current,
      state: { mic: prefs.mic, cam: prefs.cam, screen: false },
    }),
  };
}
