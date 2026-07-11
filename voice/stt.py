import queue

import numpy as np
import sounddevice as sd
from faster_whisper import WhisperModel

# Balances speed and accuracy on CPU. Use "tiny" for lower latency,
# "small"/"medium" for higher accuracy.
model = WhisperModel("base", device="cpu", compute_type="int8")

SAMPLE_RATE = 16000
CHUNK_SECONDS = 0.5
CHUNK_SAMPLES = int(CHUNK_SECONDS * SAMPLE_RATE)

# RMS threshold below which audio is treated as silence. Tune per
# microphone and environment.
SILENCE_THRESHOLD = 0.02

# Duration of continuous silence after speech has started that ends
# the recording.
SILENCE_LIMIT_SECONDS = 1.5

# Upper bound on recording length, as a safeguard against runaway capture.
MAX_RECORD_SECONDS = 15


def _volume(chunk: np.ndarray) -> float:
    return float(np.sqrt(np.mean(chunk ** 2)))


def listen() -> str:
    """Record from the microphone until the speaker stops talking, then transcribe it."""
    print("🎤 Listening...")

    audio_queue = queue.Queue()

    def callback(indata, frames, time_info, status):
        audio_queue.put(indata.copy())

    chunks = []
    started_speaking = False
    silence_seconds = 0.0
    total_seconds = 0.0

    # A single continuous stream avoids the clicks introduced by
    # repeatedly opening and closing the input device.
    with sd.InputStream(samplerate=SAMPLE_RATE, channels=1, dtype="float32",
                         blocksize=CHUNK_SAMPLES, callback=callback):
        while total_seconds < MAX_RECORD_SECONDS:
            chunk = audio_queue.get().flatten()
            chunks.append(chunk)
            total_seconds += CHUNK_SECONDS

            volume = _volume(chunk)

            if volume > SILENCE_THRESHOLD:
                started_speaking = True
                silence_seconds = 0.0
            elif started_speaking:
                silence_seconds += CHUNK_SECONDS
                if silence_seconds >= SILENCE_LIMIT_SECONDS:
                    break

    audio = np.concatenate(chunks)
    segments, _ = model.transcribe(audio, language="en")
    return " ".join(segment.text for segment in segments).strip()
