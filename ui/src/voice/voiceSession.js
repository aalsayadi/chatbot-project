// Cross-browser voice capture for the web app.
//
// Instead of the Web Speech API (Chrome-only), we capture microphone audio
// with getUserMedia + an AudioWorklet, resample it to 16 kHz mono Int16, and
// stream it over a WebSocket to the backend, which runs Silero VAD for
// endpointing and faster-whisper for transcription. Works in Chrome, Firefox,
// Safari and Edge.
//
// Usage:
//   const session = createVoiceSession({ onStatus, onTranscript, onError });
//   await session.start();     // begins listening
//   session.pause();           // stop sending audio (while thinking/speaking)
//   session.resume();          // resume listening for the next turn
//   session.stop();            // tear everything down

const TARGET_SAMPLE_RATE = 16000;
// Batch resampled audio into ~64 ms chunks before sending, to avoid a flood of
// tiny WebSocket frames. The server re-windows to Silero's 512-sample size.
const SEND_CHUNK_SAMPLES = 1024;

function resampleTo16k(float32, inputRate, carry) {
  // Linear-resample float32 @inputRate down to 16 kHz, append to `carry`
  // (a growing Float32 buffer at 16 kHz), and return the updated buffer.
  if (inputRate === TARGET_SAMPLE_RATE) {
    const merged = new Float32Array(carry.length + float32.length);
    merged.set(carry, 0);
    merged.set(float32, carry.length);
    return merged;
  }

  const ratio = inputRate / TARGET_SAMPLE_RATE;
  const outLength = Math.floor(float32.length / ratio);
  const resampled = new Float32Array(carry.length + outLength);
  resampled.set(carry, 0);

  for (let i = 0; i < outLength; i += 1) {
    const srcIndex = i * ratio;
    const low = Math.floor(srcIndex);
    const high = Math.min(low + 1, float32.length - 1);
    const frac = srcIndex - low;
    resampled[carry.length + i] =
      float32[low] * (1 - frac) + float32[high] * frac;
  }

  return resampled;
}

function encodeInt16(float32) {
  const out = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i += 1) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

export function createVoiceSession({ onStatus, onTranscript, onError }) {
  let ws = null;
  let audioContext = null;
  let mediaStream = null;
  let sourceNode = null;
  let workletNode = null;
  let paused = false;
  let stopped = false;
  let pending = new Float32Array(0); // resampled audio not yet sent

  const wsUrl = () => {
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    return `${proto}://${window.location.host}/ws/transcribe`;
  };

  const flush = (force = false) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return;
    }
    while (pending.length >= SEND_CHUNK_SAMPLES) {
      const slice = pending.subarray(0, SEND_CHUNK_SAMPLES);
      ws.send(encodeInt16(slice).buffer);
      pending = pending.slice(SEND_CHUNK_SAMPLES);
    }
    if (force && pending.length) {
      ws.send(encodeInt16(pending).buffer);
      pending = new Float32Array(0);
    }
  };

  const handleFrame = (float32) => {
    if (paused || stopped) {
      return;
    }
    pending = resampleTo16k(float32, audioContext.sampleRate, pending);
    flush(false);
  };

  const start = async () => {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    await audioContext.audioWorklet.addModule("/vad-capture-worklet.js");

    sourceNode = audioContext.createMediaStreamSource(mediaStream);
    workletNode = new AudioWorkletNode(audioContext, "vad-capture");
    workletNode.port.onmessage = (event) => handleFrame(event.data);
    sourceNode.connect(workletNode);
    // Intentionally NOT connected to destination -- we don't monitor the mic.

    ws = new WebSocket(wsUrl());
    ws.binaryType = "arraybuffer";
    ws.onmessage = (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      if (msg.type === "speech_start") {
        onStatus?.("listening");
      } else if (msg.type === "speech_end") {
        onStatus?.("transcribing");
      } else if (msg.type === "transcript") {
        onTranscript?.(msg.text || "");
      } else if (msg.type === "error") {
        onError?.(msg.message || "voice error");
      }
    };
    ws.onerror = () => onError?.("Voice connection failed.");
  };

  const pause = () => {
    paused = true;
    pending = new Float32Array(0);
  };

  const resume = () => {
    paused = false;
    pending = new Float32Array(0);
    if (ws && ws.readyState === WebSocket.OPEN) {
      // Clear the server's VAD state so the next utterance starts fresh.
      ws.send(JSON.stringify({ type: "reset" }));
    }
  };

  const stop = () => {
    stopped = true;
    try {
      workletNode?.port && (workletNode.port.onmessage = null);
      workletNode?.disconnect();
    } catch {
      // ignore
    }
    try {
      sourceNode?.disconnect();
    } catch {
      // ignore
    }
    try {
      mediaStream?.getTracks().forEach((track) => track.stop());
    } catch {
      // ignore
    }
    try {
      ws?.close();
    } catch {
      // ignore
    }
    try {
      audioContext?.close();
    } catch {
      // ignore
    }
    ws = null;
  };

  return { start, pause, resume, stop };
}
