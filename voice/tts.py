import os
import platform

import numpy as np
import soundfile as sf
from kokoro import KPipeline

# 'a' = American English
pipeline = KPipeline(lang_code="a")

# Preset voice IDs for each selectable persona.
VOICES = {
    "male": "am_puck",     # young, energetic American male
    "female": "af_heart",  # default American female voice
    "robot": "am_fenrir",  # deep American male, used for the robot persona
}

DEFAULT_VOICE = VOICES["male"]

OUTPUT_FILE = "response.wav"


def play(path: str) -> None:
    """Play a .wav file using the current OS's default audio playback."""
    system = platform.system()
    if system == "Windows":
        import winsound
        winsound.PlaySound(path, winsound.SND_FILENAME)
    elif system == "Darwin":  # macOS
        os.system(f"afplay {path}")
    else:  # Linux
        os.system(f"aplay {path}")


def speak(text: str, voice: str = DEFAULT_VOICE) -> None:
    """Convert text to speech using Kokoro and play it out loud."""
    chunks = []
    for _, _, audio in pipeline(text, voice=voice, speed=1.0):
        chunks.append(audio)

    if not chunks:
        return

    full_audio = np.concatenate(chunks)
    sf.write(OUTPUT_FILE, full_audio, 24000)

    play(OUTPUT_FILE)
