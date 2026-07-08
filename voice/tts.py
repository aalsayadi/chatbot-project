import os
import platform

import numpy as np
import soundfile as sf
from kokoro import KPipeline

# 'a' = American English
pipeline = KPipeline(lang_code="a")

# am_puck: young, playful, energetic American male voice.
# One of the highest community-rated male voices Kokoro offers.
VOICE = "am_puck"

OUTPUT_FILE = "response.wav"


def play(path: str) -> None:
    """Play a .wav file using whatever's built into the current OS."""
    system = platform.system()
    if system == "Windows":
        import winsound
        winsound.PlaySound(path, winsound.SND_FILENAME)
    elif system == "Darwin":  # macOS
        os.system(f"afplay {path}")
    else:  # Linux
        os.system(f"aplay {path}")


def speak(text: str) -> None:
    """Convert text to speech using Kokoro and play it out loud."""
    chunks = []
    for _, _, audio in pipeline(text, voice=VOICE, speed=1.0):
        chunks.append(audio)

    if not chunks:
        return

    full_audio = np.concatenate(chunks)
    sf.write(OUTPUT_FILE, full_audio, 24000)

    play(OUTPUT_FILE)
