// Talks to the FastAPI backend. In dev, Vite proxies /api -> localhost:8000
// (see vite.config.js), so relative paths work without CORS setup.

export async function sendChat({ message, persona, voiceMode = true, tts = false }) {
    const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            message,
            persona,
            voice_mode: voiceMode,
            tts,
        }),
    });

    if (!response.ok) {
        throw new Error(`Chat request failed: ${response.status}`);
    }

    // { reply, sentiment, emotion, voice, audio(base64 wav | null) }
    return response.json();
}

// Synthesize speech for a specific piece of text on demand (speaker button).
export async function synthesizeSpeech({ text, persona }) {
    const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, persona }),
    });

    if (!response.ok) {
        throw new Error(`TTS request failed: ${response.status}`);
    }

    // { audio(base64 wav | null), voice }
    return response.json();
}

// Ask the backend for a short auto-generated conversation title.
export async function generateTitle({ text }) {
    const response = await fetch("/api/title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
    });

    if (!response.ok) {
        throw new Error(`Title request failed: ${response.status}`);
    }

    // { title }
    return response.json();
}
