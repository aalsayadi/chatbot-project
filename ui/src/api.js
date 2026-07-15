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

// Streaming chat: reads newline-delimited JSON from /chat/stream and invokes
// callbacks as data arrives.
//   onMeta({ emotion, voice })   -- once, up front
//   onToken(text)                -- per generated token
//   onDone({ reply, audio })     -- once, at the end
export async function sendChatStream(
    { message, persona, voiceMode = false, tts = false },
    { onMeta, onToken, onDone } = {},
) {
    const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, persona, voice_mode: voiceMode, tts }),
    });

    if (!response.ok || !response.body) {
        throw new Error(`Chat stream failed: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    const handleLine = (line) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        let msg;
        try {
            msg = JSON.parse(trimmed);
        } catch {
            return;
        }
        if (msg.type === "meta") onMeta?.(msg);
        else if (msg.type === "token") onToken?.(msg.text || "");
        else if (msg.type === "done") onDone?.(msg);
    };

    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let newlineIndex;
        while ((newlineIndex = buffer.indexOf("\n")) >= 0) {
            handleLine(buffer.slice(0, newlineIndex));
            buffer = buffer.slice(newlineIndex + 1);
        }
    }
    // Flush any trailing partial line.
    handleLine(buffer);
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
