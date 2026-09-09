import { useCallback, useEffect, useRef, useState } from "react";

import { transcribeVoiceClip } from "@/lib/frappe/chat";

/**
 * Voice input for a composer textarea.
 *
 * Deliberately not the browser's own SpeechRecognition API: it is Chromium/
 * WebKit only (nothing in Firefox, whatever engine it's running), and the
 * request was specifically that this work in Firefox too. `getUserMedia` +
 * `MediaRecorder` are supported everywhere instead, so this records a clip
 * client-side and sends it to `alaiy_os.api.chat.transcribe_voice`, which asks
 * `engine.llm.transcribe_audio` to turn it into text — the same
 * ai_client seam `complete()` and `generate_image()` already go through, so
 * this needs no new provider wiring of its own on a deployment that already
 * has one configured (see engine/ai_client.py).
 */

export type VoiceInputState = "idle" | "recording" | "transcribing";

/** Tried in preference order; the first this browser's MediaRecorder accepts
 * wins. Opus in a WebM container is what Chrome/Edge/Firefox all record
 * natively; Safari has neither and falls back to its own AAC/mp4. */
const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) return undefined;
  return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type));
}

/** getUserMedia's own DOMException names, turned into something a user can
 * act on -- the button going quiet with no explanation is exactly the bug
 * this hook exists to fix. */
function messageForMicError(error: unknown): string {
  const name = error instanceof DOMException ? error.name : "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Microphone access is blocked. Click the camera/mic icon in the address bar and allow it for this site, then try again.";
    case "NotFoundError":
      return "No microphone was found. Check that one is connected (and not muted or claimed by another app).";
    default:
      return "Could not start the microphone. Try again.";
  }
}

export function useVoiceInput(onTranscript: (text: string) => void) {
  const [state, setState] = useState<VoiceInputState>("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Set just before stop() when the recording is being thrown away -- onstop
  // still fires either way (it's what releases the mic track), it just skips
  // the upload.
  const discardRef = useRef(false);

  // How loud the mic is *right now*, 0-1 -- so the recording indicator
  // actually reacts to the user's voice instead of just pulsing on a timer.
  // Read off the live stream, not the recording (MediaRecorder exposes no
  // level of its own), via a parallel AnalyserNode that never touches the
  // bytes being uploaded.
  const [level, setLevel] = useState(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);

  const supported =
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined";

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopLevelMeter = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    analyserRef.current = null;
    void audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    setLevel(0);
  }, []);

  const startLevelMeter = useCallback((stream: MediaStream) => {
    // Not fatal if this fails (AudioContext is occasionally blocked, e.g. by
    // a strict extension) -- the recording itself does not depend on it, only
    // the indicator's animation does.
    try {
      const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteTimeDomainData(data);
        // RMS around the 128 midpoint (silence) rather than a raw average --
        // a time-domain waveform oscillates symmetrically around it, so a
        // plain mean stays ~0 regardless of how loud the input is.
        let sumSquares = 0;
        for (let i = 0; i < data.length; i++) {
          const centered = (data[i] - 128) / 128;
          sumSquares += centered * centered;
        }
        const rms = Math.sqrt(sumSquares / data.length);
        // A quiet room still reads a little above 0 as noise floor; scaling
        // up makes an ordinary speaking voice actually swing the bars instead
        // of sitting near the bottom the whole time.
        setLevel(Math.min(1, rms * 4));
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      // No meter, no problem -- see above.
    }
  }, []);

  const stop = useCallback(() => {
    // Fires onstop below, which does the actual work -- stopping here is
    // just the signal, not the transcription itself.
    recorderRef.current?.stop();
  }, []);

  /** Stop and throw the clip away -- for a "changed my mind" cancel, not a
   * failure. Skips the upload entirely rather than transcribing and then
   * discarding the text, which would spend a call for nothing. */
  const cancel = useCallback(() => {
    discardRef.current = true;
    recorderRef.current?.stop();
  }, []);

  const start = useCallback(async () => {
    if (!supported || state !== "idle") return;
    setError(null);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      setError(messageForMicError(err));
      return;
    }

    startLevelMeter(stream);

    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    chunksRef.current = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };

    recorder.onstop = () => {
      clearTimer();
      stopLevelMeter();
      for (const track of stream.getTracks()) track.stop();

      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || "audio/webm" });
      chunksRef.current = [];

      const discard = discardRef.current;
      discardRef.current = false;
      if (discard || blob.size === 0) {
        setState("idle");
        return;
      }

      setState("transcribing");
      void transcribeVoiceClip(blob, blob.type)
        .then((text) => {
          if (text.trim()) onTranscriptRef.current(text.trim());
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : "Could not transcribe that recording.");
        })
        .finally(() => setState("idle"));
    };

    recorderRef.current = recorder;
    recorder.start();
    setState("recording");
    setSeconds(0);
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  }, [supported, state, clearTimer, startLevelMeter, stopLevelMeter]);

  const toggle = useCallback(() => {
    if (state === "recording") stop();
    else if (state === "idle") void start();
  }, [state, start, stop]);

  // Unmounting mid-recording must not leave the mic's indicator lit in the
  // browser chrome forever -- stop() releases the track via onstop.
  useEffect(
    () => () => {
      clearTimer();
      stopLevelMeter();
      recorderRef.current?.stop();
    },
    [clearTimer, stopLevelMeter],
  );

  return {
    supported,
    state,
    listening: state === "recording",
    transcribing: state === "transcribing",
    seconds,
    level,
    error,
    toggle,
    cancel,
  };
}
