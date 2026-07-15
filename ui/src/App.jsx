import { lazy, Suspense, useEffect, useRef, useState } from "react";
import sidebarIcon from "../assets/icons/sidebar.svg";
import microphoneIcon from "../assets/icons/microphone.svg";
import pinMessageIcon from "../assets/icons/pinMessage.svg";
import saveChatIcon from "../assets/icons/saveChat.svg";
import trashBinIcon from "../assets/icons/trashBin.svg";
import leftArrowIcon from "../assets/icons/leftArrow.svg";
import newChatIcon from "../assets/icons/newChat.svg";
import knowledgeGraphIcon from "../assets/icons/knowledgeGraph.svg";
import helpIcon from "../assets/icons/help.svg";
import Avatar from "./avatar/Avatar.jsx";
import { PERSONAS, PERSONA_ORDER, DEFAULT_PERSONA } from "./avatar/personas.js";
import {
  sendChatStream,
  synthesizeSpeech,
  generateTitle,
} from "./api.js";

// Cosmograph is a heavy WebGL library; load it only when the graph is opened.
const KnowledgeGraph = lazy(
  () => import("./knowledgeGraph/KnowledgeGraph.jsx"),
);

function App() {
  const [hasUsedMicOnce, setHasUsedMicOnce] = useState(false);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [persona, setPersona] = useState(DEFAULT_PERSONA);
  const [isSending, setIsSending] = useState(false);
  const selectedPersona = PERSONAS[persona] ?? PERSONAS[DEFAULT_PERSONA];
  const avatarControlsRef = useRef(null);
  const audioRef = useRef(null);
  const [isAsideOpen, setIsAsideOpen] = useState(true);
  const [isMicActive, setIsMicActive] = useState(false);
  // Web-app voice input uses the browser's built-in Web Speech API
  // (Chrome/Edge/Safari; not Firefox). Detected synchronously so the voice
  // button is disabled upfront where it's unavailable.
  const [isSpeechSupported] = useState(
    () =>
      typeof window !== "undefined" &&
      Boolean(window.SpeechRecognition || window.webkitSpeechRecognition),
  );
  const [pinnedMessageIds, setPinnedMessageIds] = useState([]);
  const [savedChats, setSavedChats] = useState([]);
  const [pendingDeleteSavedChat, setPendingDeleteSavedChat] = useState(null);
  const [isNewChatConfirmOpen, setIsNewChatConfirmOpen] = useState(false);
  const [activeSavedChatId, setActiveSavedChatId] = useState(null);
  const [isSavedChatsOpen, setIsSavedChatsOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isPinnedNavigatorOpen, setIsPinnedNavigatorOpen] = useState(false);
  const [currentPinnedIndex, setCurrentPinnedIndex] = useState(0);
  const [isKnowledgeGraphOpen, setIsKnowledgeGraphOpen] = useState(false);

  // Voice mode: mic input + auto-playing TTS + live transcript.
  const [voiceMode, setVoiceMode] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("idle"); // listening|thinking|speaking|idle
  const [voiceError, setVoiceError] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [playingMessageId, setPlayingMessageId] = useState(null);
  const voiceModeRef = useRef(false);
  const isSendingRef = useRef(false);
  const messagesRef = useRef([]);
  const recognitionRef = useRef(null);
  const speechFinalTranscriptRef = useRef("");
  const handleRecognitionEndRef = useRef(null);

  // Auto-save bookkeeping for the current conversation.
  const activeChatIdRef = useRef(null);
  const currentTitleRef = useRef(null);

  const messageRefs = useRef({});
  const conversationEndRef = useRef(null);
  const isReviewingSavedChat = activeSavedChatId !== null;
  const activeSavedChat = savedChats.find(
    (savedChat) => savedChat.id === activeSavedChatId,
  );

  // Keep refs in sync for use inside stable recognition callbacks.
  useEffect(() => {
    voiceModeRef.current = voiceMode;
  }, [voiceMode]);
  useEffect(() => {
    isSendingRef.current = isSending;
  }, [isSending]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Auto-scroll the transcript to the newest message.
  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [messages]);

  // Stop speech recognition on unmount.
  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    };
  }, []);

  // Create (lazily, inside a user gesture) the browser SpeechRecognition
  // instance, or return null if the browser doesn't support the Web Speech API.
  const ensureRecognition = () => {
    if (recognitionRef.current) {
      return recognitionRef.current;
    }
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) {
      return null;
    }

    const recognition = new Ctor();
    recognition.lang = "en-US";
    // Non-continuous: each utterance ends on a pause, giving natural
    // turn-taking (end -> send -> reply -> listen again).
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const piece = event.results[i][0]?.transcript?.trim() ?? "";
        if (!piece) continue;
        if (event.results[i].isFinal) {
          speechFinalTranscriptRef.current = [
            speechFinalTranscriptRef.current,
            piece,
          ]
            .filter(Boolean)
            .join(" ");
        } else {
          interim = [interim, piece].filter(Boolean).join(" ");
        }
      }
      const combined = [speechFinalTranscriptRef.current, interim]
        .filter(Boolean)
        .join(" ");
      setInterimTranscript(combined);
    };

    recognition.onend = () => {
      setIsMicActive(false);
      // Latest handler via ref, so it sees current state.
      handleRecognitionEndRef.current?.();
    };

    recognition.onerror = (event) => {
      setIsMicActive(false);
      const err = event?.error;
      if (err === "not-allowed" || err === "service-not-allowed") {
        setVoiceError(
          "Microphone access is blocked. Allow mic access in your browser to use voice mode.",
        );
        exitVoiceMode();
        avatarControlsRef.current?.setState("idle");
      }
    };

    recognitionRef.current = recognition;
    return recognition;
  };

  const pinnedAssistantMessageIds = messages
    .filter(
      (message) =>
        message.role === "assistant" && pinnedMessageIds.includes(message.id),
    )
    .map((message) => message.id);

  const pinnedCount = pinnedAssistantMessageIds.length;
  const currentPinnedMessageId =
    pinnedCount > 0
      ? pinnedAssistantMessageIds[Math.min(currentPinnedIndex, pinnedCount - 1)]
      : null;

  const handleAvatarReady = (controls) => {
    avatarControlsRef.current = controls;
  };

  const handleSelectPersona = (nextPersona) => {
    if (nextPersona === persona) {
      return;
    }

    setPersona(nextPersona);
    // Swap the avatar model; the matching voice follows automatically because
    // the new persona is sent to /chat on the next message.
    avatarControlsRef.current?.loadPersona(PERSONAS[nextPersona].vrmPath);
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  };

  // Start listening for the next utterance via browser speech recognition.
  const resumeListening = () => {
    if (!voiceModeRef.current) {
      return;
    }
    const recognition = ensureRecognition();
    if (!recognition) {
      return;
    }
    speechFinalTranscriptRef.current = "";
    setInterimTranscript("");
    setVoiceStatus("listening");
    setIsMicActive(true);
    avatarControlsRef.current?.setState("listening");
    try {
      recognition.start();
    } catch {
      // start() throws if it's already running; ignore.
    }
  };

  // Play base64 WAV audio and tie the avatar's "speaking" animation to actual
  // playback: speaking starts on `play`, ends on `ended`/`error`. This is the
  // ONLY place that puts the avatar into the speaking state.
  const playAudio = (base64, emotion, onDone) => {
    stopAudio();
    const controls = avatarControlsRef.current;
    const audio = new Audio(`data:audio/wav;base64,${base64}`);
    audioRef.current = audio;

    audio.onplay = () => {
      setVoiceStatus("speaking");
      controls?.setState("speaking", { emotion, intensity: 1 });
    };

    const done = () => {
      if (audioRef.current === audio) {
        audioRef.current = null;
      }
      // Keep the emotion expression but stop the speaking/lip-sync animation.
      controls?.setState("idle", { emotion });
      onDone?.();
    };
    audio.onended = done;
    audio.onerror = done;

    audio.play().catch(done);
  };

  // React to a reply. Speaking is driven purely by audio playback (see
  // playAudio); when there is no audio (text mode) we only reflect the
  // emotion and settle to idle -- no speaking animation.
  const reactToReply = (data, { viaVoice }) => {
    const controls = avatarControlsRef.current;
    const emotion = data.emotion || "default";

    // Voice mode with audio: playback drives speaking, then resume listening.
    if (viaVoice && voiceModeRef.current && data.audio) {
      playAudio(data.audio, emotion, () => {
        resumeListening();
      });
      return;
    }

    // No audio is playing: show the emotion but do NOT enter speaking.
    stopAudio();
    controls?.setState("idle", { emotion });

    if (viaVoice && voiceModeRef.current) {
      // Voice mode but the server returned no audio -- keep the loop going.
      resumeListening();
    } else {
      setVoiceStatus("idle");
    }
  };

  const submitMessage = async (text, { viaVoice }) => {
    if (isReviewingSavedChat || isSendingRef.current) {
      return;
    }

    const trimmed = (text || "").trim();
    if (!trimmed) {
      return;
    }

    const userMessage = { id: `m${Date.now()}`, role: "user", text: trimmed };
    const convoWithUser = [...messagesRef.current, userMessage];
    setMessages(convoWithUser);
    messagesRef.current = convoWithUser;

    setDraft("");
    setInterimTranscript("");
    setIsSending(true);
    isSendingRef.current = true;
    setVoiceStatus("thinking");
    avatarControlsRef.current?.setState("thinking");

    // Assistant message placeholder that fills in as tokens stream in.
    const assistantId = `m${Date.now()}-a`;
    let reply = "";
    let emotion = "default";
    let audio = null;

    const paint = () => {
      const assistantMessage = {
        id: assistantId,
        role: "assistant",
        text: reply,
        emotion,
      };
      const convoWithReply = [...convoWithUser, assistantMessage];
      setMessages(convoWithReply);
      messagesRef.current = convoWithReply;
      return convoWithReply;
    };

    try {
      paint(); // show empty assistant bubble immediately

      await sendChatStream(
        {
          message: trimmed,
          persona: PERSONAS[persona].backend,
          voiceMode: viaVoice, // shorter, spoken-style replies in voice mode
          tts: viaVoice, // only synthesize audio when actually in voice mode
        },
        {
          onMeta: (meta) => {
            emotion = meta.emotion || "default";
          },
          onToken: (text) => {
            reply += text;
            paint(); // append token live
          },
          onDone: (data) => {
            reply = data.reply ?? reply;
            audio = data.audio ?? null;
          },
        },
      );

      const convoWithReply = paint();
      reactToReply({ reply, emotion, audio }, { viaVoice });
      persistChat(convoWithReply);
    } catch (error) {
      console.error(error);
      // Show the error in the (possibly empty) assistant placeholder bubble.
      if (!reply) {
        reply =
          "Sorry, I couldn't reach the server. Please make sure the backend is running.";
      }
      paint();
      setVoiceStatus("idle");
      avatarControlsRef.current?.setState("idle");
      if (viaVoice && voiceModeRef.current) {
        resumeListening();
      }
    } finally {
      setIsSending(false);
      isSendingRef.current = false;
    }
  };

  // On each recognition turn end: auto-send what was heard, else keep listening.
  handleRecognitionEndRef.current = () => {
    if (!voiceModeRef.current) {
      return;
    }
    const spoken = speechFinalTranscriptRef.current.trim();
    speechFinalTranscriptRef.current = "";
    setInterimTranscript("");

    if (spoken) {
      submitMessage(spoken, { viaVoice: true });
    } else if (!isSendingRef.current) {
      // No speech captured; keep listening (small delay avoids a tight loop).
      window.setTimeout(() => {
        if (voiceModeRef.current && !isSendingRef.current) {
          resumeListening();
        }
      }, 400);
    }
  };

  const handleSend = () => submitMessage(draft, { viaVoice: false });

  // Play a specific assistant reply aloud on demand (text-mode speaker icon).
  // Audio is synthesized lazily here -- only when the user asks to hear it.
  const handlePlayMessage = async (message) => {
    try {
      setPlayingMessageId(message.id);
      const { audio } = await synthesizeSpeech({
        text: message.text,
        persona: PERSONAS[persona].backend,
      });
      if (!audio) {
        setPlayingMessageId(null);
        return;
      }
      playAudio(audio, message.emotion || "default", () =>
        setPlayingMessageId(null),
      );
    } catch (error) {
      console.error(error);
      setPlayingMessageId(null);
    }
  };

  const handleComposerKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const handleTogglePinnedMessage = (messageId) => {
    setPinnedMessageIds((previousIds) => {
      if (previousIds.includes(messageId)) {
        return previousIds.filter((id) => id !== messageId);
      }

      return [...previousIds, messageId];
    });
  };

  const scrollToPinnedIndex = (targetIndex) => {
    const targetId = pinnedAssistantMessageIds[targetIndex];
    if (!targetId) {
      return;
    }

    const targetMessageElement = messageRefs.current[targetId];
    if (targetMessageElement) {
      targetMessageElement.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  };

  const handleTogglePinnedNavigator = () => {
    setIsPinnedNavigatorOpen((previousValue) => {
      const nextValue = !previousValue;

      if (nextValue && pinnedCount > 0) {
        const safeIndex = Math.min(currentPinnedIndex, pinnedCount - 1);
        requestAnimationFrame(() => {
          scrollToPinnedIndex(safeIndex);
        });
      }

      return nextValue;
    });
  };

  const handleNavigatePinnedMessages = (direction) => {
    if (pinnedCount === 0) {
      return;
    }

    setCurrentPinnedIndex((previousIndex) => {
      const nextIndex =
        direction === "up"
          ? (previousIndex - 1 + pinnedCount) % pinnedCount
          : (previousIndex + 1) % pinnedCount;

      requestAnimationFrame(() => {
        scrollToPinnedIndex(nextIndex);
      });

      return nextIndex;
    });
  };

  const handleToggleVoiceMode = () => {
    if (isReviewingSavedChat) {
      return;
    }

    if (voiceModeRef.current) {
      // Exit voice mode: stop recognition and return the avatar to idle.
      exitVoiceMode();
      avatarControlsRef.current?.setState("idle");
      return;
    }

    // Enter voice mode: create recognition inside this click gesture (some
    // browsers require that). getUserMedia/permission is handled by the API.
    const recognition = ensureRecognition();
    if (!recognition) {
      setVoiceError(
        "Voice input isn't available in this browser. Try Chrome, Edge, or Safari.",
      );
      return;
    }

    setVoiceError("");
    voiceModeRef.current = true;
    setVoiceMode(true);
    // Team UI: expand the left panel the first time the mic is used.
    if (!hasUsedMicOnce) {
      setHasUsedMicOnce(true);
    }
    resumeListening();
  };

  useEffect(() => {
    if (pinnedCount === 0) {
      setCurrentPinnedIndex(0);
      return;
    }

    setCurrentPinnedIndex((previousIndex) =>
      Math.min(previousIndex, pinnedCount - 1),
    );
  }, [pinnedCount]);

  // --- Automatic conversation saving -----------------------------------
  const buildTranscriptSnippet = (convo) =>
    convo
      .slice(0, 4)
      .map(
        (message) =>
          `${message.role === "user" ? "User" : "Assistant"}: ${message.text.slice(0, 200)}`,
      )
      .join("\n");

  const upsertSavedChat = (convo) => {
    const id = activeChatIdRef.current;
    if (!id) {
      return;
    }

    const assistantMessageCount = convo.filter(
      (message) => message.role === "assistant",
    ).length;

    const savedLabelTime = new Date().toLocaleString([], {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const entry = {
      id,
      title: currentTitleRef.current || "Conversation",
      summary: `${convo.length} messages, ${assistantMessageCount} assistant`,
      savedAt: savedLabelTime,
      messages: convo,
      pinnedMessageIds,
    };

    setSavedChats((previousChats) => {
      const index = previousChats.findIndex((chat) => chat.id === id);
      if (index === -1) {
        return [entry, ...previousChats];
      }
      const next = [...previousChats];
      next[index] = entry;
      return next;
    });
  };

  // Persist the conversation automatically after each exchange. Generates a
  // fitting title from the content the first time it becomes savable.
  const persistChat = (convo) => {
    if (isReviewingSavedChat) {
      return;
    }
    if (!convo.some((message) => message.role === "assistant")) {
      return; // nothing meaningful to save yet
    }

    if (!activeChatIdRef.current) {
      const chatId = `saved-${Date.now()}`;
      activeChatIdRef.current = chatId;

      // Provisional title from the first user message; refined via the LLM.
      const firstUser = convo.find((message) => message.role === "user");
      const fallback = firstUser
        ? firstUser.text.slice(0, 32) + (firstUser.text.length > 32 ? "…" : "")
        : "New conversation";
      currentTitleRef.current = fallback;

      generateTitle({ text: buildTranscriptSnippet(convo) })
        .then(({ title }) => {
          // Ignore if the user has since moved to a different conversation.
          if (title && activeChatIdRef.current === chatId) {
            currentTitleRef.current = title;
            upsertSavedChat(messagesRef.current);
          }
        })
        .catch(() => {
          // keep the fallback title
        });
    }

    upsertSavedChat(convo);
  };

  const resetActiveChat = () => {
    activeChatIdRef.current = null;
    currentTitleRef.current = null;
  };

  const exitVoiceMode = () => {
    voiceModeRef.current = false;
    setVoiceMode(false);
    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore
    }
    stopAudio();
    setIsMicActive(false);
    setInterimTranscript("");
    setVoiceStatus("idle");
  };

  const handleLoadSavedChat = (savedChat) => {
    exitVoiceMode();
    setIsNewChatConfirmOpen(false);
    setMessages(savedChat.messages);
    messagesRef.current = savedChat.messages;
    setPinnedMessageIds(savedChat.pinnedMessageIds ?? []);
    setDraft("");
    setActiveSavedChatId(savedChat.id);
    setIsPinnedNavigatorOpen(false);
    setIsSavedChatsOpen(false);
    setIsHelpOpen(false);
    setIsKnowledgeGraphOpen(false);
  };

  const startNewChat = () => {
    exitVoiceMode();
    resetActiveChat();
    setIsNewChatConfirmOpen(false);
    setMessages([]);
    messagesRef.current = [];
    setDraft("");
    setPinnedMessageIds([]);
    setIsPinnedNavigatorOpen(false);
    setCurrentPinnedIndex(0);
    setActiveSavedChatId(null);
    setIsSavedChatsOpen(false);
    setIsHelpOpen(false);
    setIsKnowledgeGraphOpen(false);
    avatarControlsRef.current?.setState("idle");
  };

  const handleStartNewChat = () => {
    const hasConversation = messagesRef.current.length > 0;
    if (isReviewingSavedChat || hasConversation) {
      setIsAsideOpen(true);
      setIsNewChatConfirmOpen(true);
      return;
    }

    startNewChat();
  };

  const handleCancelStartNewChat = () => {
    setIsNewChatConfirmOpen(false);
  };

  const handleConfirmStartNewChat = () => {
    startNewChat();
  };

  const handleOpenSavedChats = () => {
    setIsAsideOpen(true);
    setIsSavedChatsOpen(true);
    setIsHelpOpen(false);
  };

  const handleOpenKnowledgeGraph = () => {
    setIsKnowledgeGraphOpen(true);
    setIsSavedChatsOpen(false);
    setIsHelpOpen(false);
  };

  const handleOpenHelp = () => {
    setIsAsideOpen(true);
    setIsHelpOpen(true);
    setIsSavedChatsOpen(false);
  };

  const handleDeleteSavedChat = (savedChatId) => {
    setSavedChats((previousChats) =>
      previousChats.filter((savedChat) => savedChat.id !== savedChatId),
    );

    if (activeSavedChatId === savedChatId) {
      setActiveSavedChatId(null);
    }
  };

  const handleRequestDeleteSavedChat = (savedChat) => {
    setPendingDeleteSavedChat(savedChat);
  };

  const handleCancelDeleteSavedChat = () => {
    setPendingDeleteSavedChat(null);
  };

  const handleConfirmDeleteSavedChat = () => {
    if (!pendingDeleteSavedChat) {
      return;
    }

    handleDeleteSavedChat(pendingDeleteSavedChat.id);
    setPendingDeleteSavedChat(null);
  };

  return (
    <div
      className={`appFrame ${isAsideOpen ? "rightAsideOpen" : ""} ${isMicActive ? "leftAsideMicActive" : ""}`.trim()}
    >
      <aside className="avatarPanel">
        <div className="assistantHead">
          <div className="assistantBadge">Care Companion</div>
        </div>

        <div className="avatarStage">
          <div className="avatarGlow" aria-hidden="true" />
          <Avatar persona={persona} onReady={handleAvatarReady} />
        </div>

        <div
          className="personaSwitcher"
          role="group"
          aria-label="Choose avatar persona"
        >
          {PERSONA_ORDER.map((personaKey) => (
            <button
              key={personaKey}
              type="button"
              className={`personaButton ${persona === personaKey ? "active" : ""}`}
              aria-pressed={persona === personaKey}
              onClick={() => handleSelectPersona(personaKey)}
            >
              {PERSONAS[personaKey].label}
            </button>
          ))}
        </div>

        <button
          type="button"
          className={`avatarMicButton ${voiceMode ? "active" : ""}`}
          aria-label={voiceMode ? "Stop voice mode" : "Start voice mode"}
          aria-pressed={voiceMode}
          onClick={handleToggleVoiceMode}
          disabled={isReviewingSavedChat || !isSpeechSupported}
          title={
            isSpeechSupported
              ? voiceMode
                ? "Stop voice mode"
                : "Start voice mode"
              : "Voice mode needs a browser with microphone + AudioWorklet support"
          }
        >
          <img
            src={microphoneIcon}
            alt=""
            aria-hidden="true"
            className="microphoneIcon"
          />
        </button>

        {!isSpeechSupported && (
          <p className="voiceHint">
            Voice mode isn&apos;t available in this browser.
          </p>
        )}
        {voiceError && <p className="voiceError">{voiceError}</p>}

        {voiceMode ? (
          <div className="voiceStatus" aria-live="polite">
            <span className={`voiceStatusPill ${voiceStatus}`}>
              {voiceStatus === "listening" && "Listening…"}
              {voiceStatus === "transcribing" && "Transcribing…"}
              {voiceStatus === "thinking" && "Thinking…"}
              {voiceStatus === "speaking" && "Speaking…"}
              {voiceStatus === "idle" && "Voice mode"}
            </span>
            {interimTranscript && (
              <p className="voiceInterim">{interimTranscript}</p>
            )}
          </div>
        ) : (
          !hasUsedMicOnce &&
          messages.length === 0 && (
            <div className="assistantBubble">
              Hello, I'm here to support you. How can I assist you today?
            </div>
          )
        )}

        <div className="assistantFooter">
          As a Care Companion, I'm here to provide support and guidance. Beware
          that Chatbots make mistakes. Verify any information I provide with a
          qualified professional.
        </div>
      </aside>

      <main className="chatPanel">
        <header className="chatHeader">
          <div>
            <p className="chatEyebrow">Chat</p>
            <h2>
              Conversation
              {activeSavedChat ? ` "${activeSavedChat.title}"` : ""}
            </h2>
          </div>
          <div className="headerControls">
            {isPinnedNavigatorOpen && (
              <div
                id="pinned-messages-navigator"
                className="pinnedNavigator"
                aria-label="Pinned message navigation"
              >
                <button
                  type="button"
                  className="pinnedNavArrow"
                  aria-label="Previous pinned message"
                  onClick={() => handleNavigatePinnedMessages("up")}
                  disabled={pinnedCount === 0}
                >
                  ↑
                </button>
                <span className="pinnedNavigatorCount" aria-live="polite">
                  {pinnedCount === 0
                    ? "0 pinned"
                    : `${currentPinnedIndex + 1}/${pinnedCount} pinned`}
                </span>
                <button
                  type="button"
                  className="pinnedNavArrow"
                  aria-label="Next pinned message"
                  onClick={() => handleNavigatePinnedMessages("down")}
                  disabled={pinnedCount === 0}
                >
                  ↓
                </button>
              </div>
            )}
            <button
              type="button"
              className="headerPinnedButton"
              aria-label="Pinned Messages"
              aria-expanded={isPinnedNavigatorOpen}
              aria-controls="pinned-messages-navigator"
              onClick={handleTogglePinnedNavigator}
            >
              <img
                src={pinMessageIcon}
                alt=""
                aria-hidden="true"
                className="headerPinnedIcon"
              />
            </button>
          </div>
        </header>

        <section className="conversation" aria-label="Chat history">
          {messages.map((message) => (
            <article key={message.id} className={`messageRow ${message.role}`}>
              {message.role === "assistant" && (
                <div
                  className="messageAvatar"
                  aria-label={selectedPersona.label}
                >
                  <img
                    src={selectedPersona.avatarImage}
                    alt={selectedPersona.label}
                    className="messageAvatarImage"
                  />
                </div>
              )}
              <div className="messageColumn">
                <div
                  className={`messageBubble ${message.role} ${
                    isPinnedNavigatorOpen &&
                    message.role === "assistant" &&
                    message.id === currentPinnedMessageId
                      ? "pinnedTarget"
                      : ""
                  }`}
                  ref={
                    message.role === "assistant"
                      ? (element) => {
                          if (element) {
                            messageRefs.current[message.id] = element;
                          } else {
                            delete messageRefs.current[message.id];
                          }
                        }
                      : undefined
                  }
                >
                  {message.role === "assistant" && (
                    <button
                      type="button"
                      className={`pinMessageButton ${
                        pinnedMessageIds.includes(message.id) ? "active" : ""
                      }`}
                      aria-label={
                        pinnedMessageIds.includes(message.id)
                          ? "Unpin message"
                          : "Pin message"
                      }
                      aria-pressed={pinnedMessageIds.includes(message.id)}
                      onClick={() => handleTogglePinnedMessage(message.id)}
                    >
                      <img
                        src={pinMessageIcon}
                        alt=""
                        aria-hidden="true"
                        className="pinMessageIcon"
                      />
                    </button>
                  )}
                  {message.role === "assistant" && !voiceMode && (
                    <button
                      type="button"
                      className={`speakMessageButton ${
                        playingMessageId === message.id ? "active" : ""
                      }`}
                      aria-label="Play this reply aloud"
                      onClick={() => handlePlayMessage(message)}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                        className="speakMessageIcon"
                      >
                        <path
                          fill="currentColor"
                          d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4.03v8.06A4.5 4.5 0 0 0 16.5 12zM14 3.23v2.06a7 7 0 0 1 0 13.42v2.06a9 9 0 0 0 0-17.54z"
                        />
                      </svg>
                    </button>
                  )}
                  {message.text}
                </div>
                <div className="messageTime">{message.time}</div>
              </div>
            </article>
          ))}
          <div ref={conversationEndRef} />
        </section>

        {isReviewingSavedChat && (
          <p className="reviewModeNotice" aria-live="polite">
            This is a saved conversation in read only mode. Start a new chat to
            continue messaging.
          </p>
        )}

        <p className="composerSaveNotice">
          This conversation will be automatically saved when you start a new
          chat.
        </p>

        {voiceMode ? (
          <section className="voiceComposer" aria-label="Voice mode">
            <span
              className={`voiceComposerDot ${voiceStatus}`}
              aria-hidden="true"
            />
            <span className="voiceComposerText" aria-live="polite">
              {voiceStatus === "listening" && "Listening… speak now"}
              {voiceStatus === "transcribing" && "Transcribing…"}
              {voiceStatus === "thinking" && "Thinking…"}
              {voiceStatus === "speaking" && "Speaking…"}
              {voiceStatus === "idle" && "Voice mode active"}
            </span>
            <button
              type="button"
              className="voiceStopButton"
              onClick={handleToggleVoiceMode}
            >
              Stop voice mode
            </button>
          </section>
        ) : (
          <section className="composerRow" aria-label="Compose message">
            <div className="composerField">
              <input
                type="text"
                placeholder={
                  isReviewingSavedChat
                    ? "Review mode: Start a new chat to continue..."
                    : "Ask a question or type a message..."
                }
                aria-label="Write a message"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleComposerKeyDown}
                disabled={isReviewingSavedChat || isSending}
              />
              <button
                type="button"
                className="sendButton"
                aria-label="Send message"
                onClick={handleSend}
                disabled={isReviewingSavedChat || isSending}
              >
                ➤
              </button>
            </div>
          </section>
        )}
      </main>

      <aside id="rightaside" className="rightAsidePanel" aria-label="Options">
        <div className={`rightAsideHead ${isAsideOpen ? "open" : "collapsed"}`}>
          {isAsideOpen && <h3>Options</h3>}

          <button
            type="button"
            className="rightAsideToggleButton"
            aria-label={
              isAsideOpen ? "Collapse right sidebar" : "Expand right sidebar"
            }
            aria-expanded={isAsideOpen}
            aria-controls="rightaside-content"
            onClick={() => setIsAsideOpen((currentValue) => !currentValue)}
          >
            <img
              src={sidebarIcon}
              alt=""
              aria-hidden="true"
              className="rightAsideToggleIcon"
            />
          </button>
        </div>

        {!isAsideOpen && (
          <div className="collapsedAsideActions" aria-label="Quick options">
            <button
              type="button"
              className="collapsedAsideActionButton"
              aria-label="New Chat"
              onClick={handleStartNewChat}
            >
              <img
                src={newChatIcon}
                alt=""
                aria-hidden="true"
                className="collapsedAsideActionIcon"
              />
            </button>
            <button
              type="button"
              className="collapsedAsideActionButton"
              aria-label="Saved Conversations"
              onClick={handleOpenSavedChats}
            >
              <img
                src={saveChatIcon}
                alt=""
                aria-hidden="true"
                className="collapsedAsideActionIcon"
              />
            </button>
            <button
              type="button"
              className="collapsedAsideActionButton"
              aria-label="Knowledge Graph"
              onClick={handleOpenKnowledgeGraph}
            >
              <img
                src={knowledgeGraphIcon}
                alt=""
                aria-hidden="true"
                className="collapsedAsideActionIcon"
              />
            </button>
            <button
              type="button"
              className="collapsedAsideActionButton"
              aria-label="Help"
              onClick={handleOpenHelp}
            >
              <img
                src={helpIcon}
                alt=""
                aria-hidden="true"
                className="collapsedAsideActionIcon"
              />
            </button>
          </div>
        )}

        <div
          id="rightaside-content"
          className={`rightAsideContent ${isAsideOpen ? "open" : "collapsed"}`}
        >
          {isSavedChatsOpen ? (
            <section
              className="savedChatsView"
              aria-label="Saved Conversations"
            >
              <div className="savedChatsViewHeader">
                <h4>Saved Conversations</h4>
                <button
                  type="button"
                  className="savedChatsCloseButton"
                  aria-label="Back to options"
                  onClick={() => setIsSavedChatsOpen(false)}
                >
                  <img
                    src={leftArrowIcon}
                    alt=""
                    aria-hidden="true"
                    className="savedChatsCloseIcon"
                  />
                </button>
              </div>

              <div id="saved-conversations-list" className="savedChatsList">
                {savedChats.length === 0 ? (
                  <p className="savedChatsEmpty">No saved conversations yet.</p>
                ) : (
                  savedChats.map((savedChat) => (
                    <div key={savedChat.id} className="savedChatRow">
                      <button
                        type="button"
                        className="savedChatItem"
                        onClick={() => handleLoadSavedChat(savedChat)}
                        aria-label={`Load ${savedChat.title}`}
                        title={savedChat.title}
                      >
                        <span className="savedChatTitle">
                          {savedChat.title}
                        </span>
                        <span className="savedChatMeta">
                          {savedChat.savedAt} • {savedChat.summary}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="savedChatDeleteButton"
                        onClick={() => handleRequestDeleteSavedChat(savedChat)}
                        aria-label={`Delete ${savedChat.title}`}
                      >
                        <img
                          src={trashBinIcon}
                          alt=""
                          aria-hidden="true"
                          className="savedChatDeleteIcon"
                        />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </section>
          ) : isHelpOpen ? (
            <section className="helpView" aria-label="Help">
              <div className="helpViewHeader">
                <h4>Help</h4>
                <button
                  type="button"
                  className="helpCloseButton"
                  aria-label="Back to options"
                  onClick={() => setIsHelpOpen(false)}
                >
                  <img
                    src={leftArrowIcon}
                    alt=""
                    aria-hidden="true"
                    className="helpCloseIcon"
                  />
                </button>
              </div>
              <ul className="helpList">
                <li>
                  <b>Choosing an assistant:</b> Underneath the moving assistant
                  you can find a row of assistants to choose from. You can
                  either chose Felix, Lisa or a Atlas to talk to.
                </li>
                <li>
                  <b>Sending Messages:</b> Under the row of assistants, you can
                  find the microphone. It activates by clicking on it. Please
                  speak while it's pulsating in red. When you have stopped
                  talking click on it again and verify in the textfield, if the
                  text is correct. If not, please edit it. Afterwardsclick the
                  send button on the right side of the textfield to send the
                  message to the assistant. You can also send a message by
                  typing it directly in the textfield and pressing enter or
                  clicking the send button.
                </li>
                <li>
                  <b>Pinning a Message:</b> You can pin a message from the
                  assistant by clicking the pin symbol on the top right corner
                  that appears when hovering over the assistant's message. To
                  see all the pinned messages you can click on the pin symbol on
                  the top right corner of the Conversation panel. You can
                  navigate through the pinned messages by clicking on the up and
                  down arrows next to the pin symbol.
                </li>
                <li>
                  <b>Saving a Chat:</b> By default, the assistant saves your
                  conversation automatically, when you end the chat. You end a
                  chat by opening a "New chat" (+) button. You can access your
                  saved conversations by clicking on the "Saved Conversations"
                  button in the right sidebar. You can also delete a saved
                  conversation by clicking on the trash bin icon next to it.
                </li>
                <li>
                  <b>Options:</b> you can open a new chat by clicking the "New
                  Chat" button in the right sidebar. You can access saved
                  conversations by clicking the "Saved Conversations" button
                  underneath it. You can access the knowledge graph by clicking
                  the "Knowledge Graph" button underneath it.
                </li>
              </ul>
            </section>
          ) : (
            <>
              <button
                type="button"
                className="newChatButton"
                aria-label="New Chat"
                onClick={handleStartNewChat}
              >
                <img
                  src={newChatIcon}
                  alt=""
                  aria-hidden="true"
                  className="rightAsideOptionIcon"
                />
                New Chat
              </button>
              <button
                type="button"
                className="savedChatsButton"
                aria-label="Saved Chats"
                aria-expanded={isSavedChatsOpen}
                aria-controls="saved-conversations-list"
                onClick={handleOpenSavedChats}
              >
                <img
                  src={saveChatIcon}
                  alt=""
                  aria-hidden="true"
                  className="rightAsideOptionIcon"
                />
                Saved Conversations
              </button>
              <button
                type="button"
                className="knowledgeGraphButton"
                aria-label="Knowledge Graph"
                onClick={handleOpenKnowledgeGraph}
              >
                <img
                  src={knowledgeGraphIcon}
                  alt=""
                  aria-hidden="true"
                  className="rightAsideOptionIcon"
                />
                Knowledge Graph
              </button>
              <button
                type="button"
                className="helpButton"
                aria-expanded={isHelpOpen}
                aria-label="Help"
                onClick={handleOpenHelp}
              >
                <img
                  src={helpIcon}
                  alt=""
                  aria-hidden="true"
                  className="rightAsideOptionIcon"
                />
                Help
              </button>
            </>
          )}
        </div>
      </aside>

      {isNewChatConfirmOpen && (
        <div className="saveTitleModalOverlay" role="presentation">
          <div
            className="saveTitleModal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-chat-confirm-heading"
          >
            <h3 id="new-chat-confirm-heading">Start a new chat?</h3>
            <p className="saveTitleHint">
              The current conversation will be automatically saved. Saved
              conversations are read only. Are you sure you want to leave this
              conversation and start a new chat?
            </p>
            <div className="saveTitleActions">
              <button
                type="button"
                className="saveTitleCancelButton"
                onClick={handleCancelStartNewChat}
              >
                Cancel
              </button>
              <button
                type="button"
                className="saveTitleConfirmButton"
                onClick={handleConfirmStartNewChat}
              >
                Start New Chat
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingDeleteSavedChat && (
        <div className="saveTitleModalOverlay" role="presentation">
          <div
            className="saveTitleModal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-chat-heading"
          >
            <h3 id="delete-chat-heading">Delete Saved Conversation?</h3>
            <p className="saveTitleHint">
              Do you really want to delete "{pendingDeleteSavedChat.title}"?
            </p>
            <div className="saveTitleActions">
              <button
                type="button"
                className="saveTitleCancelButton"
                onClick={handleCancelDeleteSavedChat}
              >
                Cancel
              </button>
              <button
                type="button"
                className="deleteConfirmButton"
                onClick={handleConfirmDeleteSavedChat}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {isKnowledgeGraphOpen && (
        <div
          className="kgOverlay"
          role="dialog"
          aria-modal="true"
          aria-label="Knowledge Graph"
        >
          <div className="kgHeader">
            <h3>Knowledge Graph</h3>
            <button
              type="button"
              className="kgCloseButton"
              aria-label="Close knowledge graph"
              onClick={() => setIsKnowledgeGraphOpen(false)}
            >
              ✕
            </button>
          </div>
          <div className="kgBody">
            <Suspense
              fallback={<p className="kgLoading">Loading knowledge graph…</p>}
            >
              <KnowledgeGraph />
            </Suspense>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
