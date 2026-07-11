"""Speech-to-text and voice-activity detection.

Both the CLI (main.py voice mode) and the web server share this module so the
two surfaces use the *same* transcription model (faster-whisper) and the same
neural voice-activity detector (Silero VAD) for endpointing -- instead of the
old crude RMS volume threshold.

- `transcribe_pcm(audio, sr)`   -> text, used by CLI and the /ws/transcribe WS.
- `SileroEndpointer`            -> streaming VAD; emits speech start/utterance
                                   events as audio is fed in, for both the CLI
                                   loop and the server WebSocket.
- `listen()`                    -> CLI helper: capture mic until the speaker
                                   stops (Silero VAD), then transcribe.
"""

import threading

import numpy as np
from faster_whisper import WhisperModel

SAMPLE_RATE = 16000

# Silero VAD operates on fixed windows: 512 samples at 16 kHz.
VAD_WINDOW = 512

# --- faster-whisper model (shared, lazily loaded) --------------------------
# "base" balances speed/accuracy on CPU. Loaded on first use so importing this
# module (e.g. from the web server) stays cheap until voice is actually used.
_model = None
_model_lock = threading.Lock()


def _get_model() -> WhisperModel:
    global _model
    if _model is None:
        with _model_lock:
            if _model is None:
                _model = WhisperModel("base", device="cpu", compute_type="int8")
    return _model


def transcribe_pcm(audio: np.ndarray, sample_rate: int = SAMPLE_RATE) -> str:
    """Transcribe mono float32 PCM (expected at 16 kHz) to text.

    `vad_filter=True` runs faster-whisper's bundled Silero VAD to strip any
    remaining non-speech, which keeps hallucinated text on trailing silence
    to a minimum.
    """
    if audio is None or len(audio) == 0:
        return ""

    audio = np.asarray(audio, dtype=np.float32)
    segments, _ = _get_model().transcribe(
        audio,
        language="en",
        vad_filter=True,
    )
    return " ".join(segment.text for segment in segments).strip()


class SileroEndpointer:
    """Streaming Silero VAD endpointer.

    Feed mono float32 audio at 16 kHz via `process()`; it buffers into
    512-sample windows, runs Silero VAD, and returns a list of events:

        ("start", None)          -- speech onset detected
        ("utterance", np.ndarray) -- speech ended; here is the captured audio

    This is the same VAD family faster-whisper bundles, used here in a
    streaming fashion so we know *when the user stopped talking* in real time
    -- the piece the old RMS threshold did poorly.
    """

    def __init__(
        self,
        sample_rate: int = SAMPLE_RATE,
        threshold: float = 0.5,
        min_silence_ms: int = 700,
        speech_pad_ms: int = 200,
    ):
        # Imported lazily so the module imports without silero-vad installed
        # until an endpointer is actually constructed.
        from silero_vad import load_silero_vad, VADIterator

        self.sample_rate = sample_rate
        self._model = load_silero_vad()
        self._vad = VADIterator(
            self._model,
            threshold=threshold,
            sampling_rate=sample_rate,
            min_silence_duration_ms=min_silence_ms,
            speech_pad_ms=speech_pad_ms,
        )
        self._leftover = np.zeros(0, dtype=np.float32)
        self._speech: list[np.ndarray] = []
        self._in_speech = False

    def process(self, audio: np.ndarray):
        """Feed float32 mono audio at `sample_rate`; return a list of events."""
        events = []
        buf = np.concatenate([self._leftover, np.asarray(audio, dtype=np.float32)])

        usable = (len(buf) // VAD_WINDOW) * VAD_WINDOW
        self._leftover = buf[usable:]

        for start in range(0, usable, VAD_WINDOW):
            window = buf[start:start + VAD_WINDOW]

            if self._in_speech:
                self._speech.append(window)

            result = self._vad(window, return_seconds=False)
            if not result:
                continue

            if "start" in result:
                self._in_speech = True
                self._speech = [window]
                events.append(("start", None))
            elif "end" in result:
                self._in_speech = False
                utterance = (
                    np.concatenate(self._speech)
                    if self._speech
                    else np.zeros(0, dtype=np.float32)
                )
                self._speech = []
                events.append(("utterance", utterance))

        return events

    def reset(self) -> None:
        """Clear VAD state between turns (e.g. after the assistant replies)."""
        self._vad.reset_states()
        self._leftover = np.zeros(0, dtype=np.float32)
        self._speech = []
        self._in_speech = False


def listen(max_seconds: float = 30.0) -> str:
    """CLI helper: record until the speaker stops (Silero VAD), then transcribe.

    Replaces the old RMS volume-threshold endpointing with the neural VAD.
    """
    # Imported lazily so importing this module elsewhere (e.g. the web server)
    # doesn't require a working audio backend.
    import queue
    import sounddevice as sd

    print("🎤 Listening...")

    endpointer = SileroEndpointer(sample_rate=SAMPLE_RATE)
    audio_queue: "queue.Queue[np.ndarray]" = queue.Queue()

    def callback(indata, frames, time_info, status):
        audio_queue.put(indata.copy())

    utterance = None
    elapsed = 0.0
    seconds_per_window = VAD_WINDOW / SAMPLE_RATE

    # blocksize=VAD_WINDOW gives us one Silero window per callback.
    with sd.InputStream(
        samplerate=SAMPLE_RATE,
        channels=1,
        dtype="float32",
        blocksize=VAD_WINDOW,
        callback=callback,
    ):
        while elapsed < max_seconds:
            chunk = audio_queue.get().flatten()
            elapsed += seconds_per_window

            for kind, data in endpointer.process(chunk):
                if kind == "utterance":
                    utterance = data
                    break

            if utterance is not None:
                break

    if utterance is None or len(utterance) == 0:
        return ""

    return transcribe_pcm(utterance, SAMPLE_RATE)
