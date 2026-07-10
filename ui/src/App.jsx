import { useEffect, useRef, useState } from "react";
import sidebarIcon from "../assets/icons/sidebar.svg";
import microphoneIcon from "../assets/icons/microphone.svg";
import pinMessageIcon from "../assets/icons/pinMessage.svg";
import saveChatIcon from "../assets/icons/saveChat.svg";
import trashBinIcon from "../assets/icons/trashBin.svg";
import leftArrowIcon from "../assets/icons/leftArrow.svg";

const initialMessages = [
  {
    id: "m1",
    role: "user",
    text: "Which support options are available for caregivers?",
  },
  {
    id: "m2",
    role: "assistant",
    text: "There are various support options available. These include training, financial assistance, and counseling services.",
  },
  {
    id: "m3",
    role: "user",
    text: "Can you tell me more about the counseling services?",
  },
  {
    id: "m4",
    role: "assistant",
    text: "Counseling services include individual and group sessions, as well as online resources. These services aim to provide emotional support and practical advice for caregivers.",
  },
];

function App() {
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [isAsideOpen, setIsAsideOpen] = useState(true);
  const [isMicActive, setIsMicActive] = useState(false);
  const [isSpeechSupported, setIsSpeechSupported] = useState(true);
  const [pinnedMessageIds, setPinnedMessageIds] = useState([]);
  const [savedChats, setSavedChats] = useState([]);
  const [isSaveTitleModalOpen, setIsSaveTitleModalOpen] = useState(false);
  const [saveTitleDraft, setSaveTitleDraft] = useState("");
  const [pendingDeleteSavedChat, setPendingDeleteSavedChat] = useState(null);
  const [activeSavedChatId, setActiveSavedChatId] = useState(null);
  const [isSavedChatsOpen, setIsSavedChatsOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isPinnedNavigatorOpen, setIsPinnedNavigatorOpen] = useState(false);
  const [currentPinnedIndex, setCurrentPinnedIndex] = useState(0);
  const messageRefs = useRef({});
  const recognitionRef = useRef(null);
  const speechBaseDraftRef = useRef("");
  const speechFinalTranscriptRef = useRef("");
  const isReviewingSavedChat = activeSavedChatId !== null;
  const activeSavedChat = savedChats.find(
    (savedChat) => savedChat.id === activeSavedChatId,
  );

  useEffect(() => {
    const SpeechRecognitionCtor =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      setIsSpeechSupported(false);
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let interimTranscript = "";

      for (
        let resultIndex = event.resultIndex;
        resultIndex < event.results.length;
        resultIndex += 1
      ) {
        const transcriptPiece =
          event.results[resultIndex][0]?.transcript?.trim() ?? "";

        if (!transcriptPiece) {
          continue;
        }

        if (event.results[resultIndex].isFinal) {
          speechFinalTranscriptRef.current = [
            speechFinalTranscriptRef.current,
            transcriptPiece,
          ]
            .filter(Boolean)
            .join(" ");
        } else {
          interimTranscript = [interimTranscript, transcriptPiece]
            .filter(Boolean)
            .join(" ");
        }
      }

      const nextDraft = [
        speechBaseDraftRef.current,
        speechFinalTranscriptRef.current,
        interimTranscript,
      ]
        .filter(Boolean)
        .join(" ");

      setDraft(nextDraft);
    };

    recognition.onend = () => {
      setIsMicActive(false);
    };

    recognition.onerror = () => {
      setIsMicActive(false);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
      recognitionRef.current = null;
    };
  }, []);

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

  const handleSend = () => {
    if (isReviewingSavedChat) {
      return;
    }

    if (isMicActive && recognitionRef.current) {
      recognitionRef.current.stop();
    }

    const trimmedDraft = draft.trim();
    if (!trimmedDraft) {
      return;
    }

    const newMessage = {
      id: `m${Date.now()}`,
      role: "user",
      text: trimmedDraft,
    };

    setMessages((previousMessages) => [...previousMessages, newMessage]);
    setDraft("");
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

  const handleToggleMicrophone = () => {
    if (isReviewingSavedChat || !isSpeechSupported || !recognitionRef.current) {
      return;
    }

    if (isMicActive) {
      recognitionRef.current.stop();
      return;
    }

    speechBaseDraftRef.current = draft.trim();
    speechFinalTranscriptRef.current = "";

    try {
      recognitionRef.current.start();
      setIsMicActive(true);
    } catch {
      setIsMicActive(false);
    }
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

  const handleSaveChat = () => {
    setSaveTitleDraft("");
    setIsSaveTitleModalOpen(true);
  };

  const handleConfirmSaveChat = () => {
    const savedTitle = saveTitleDraft.trim();
    if (!savedTitle) {
      return;
    }

    const savedChatId = `saved-${Date.now()}`;
    const savedLabelTime = new Date().toLocaleString([], {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const assistantMessageCount = messages.filter(
      (message) => message.role === "assistant",
    ).length;

    const newSavedChat = {
      id: savedChatId,
      title: savedTitle,
      summary: `${messages.length} messages, ${assistantMessageCount} assistant`,
      savedAt: savedLabelTime,
      messages,
      pinnedMessageIds,
    };

    setSavedChats((previousChats) => [newSavedChat, ...previousChats]);
    setIsSaveTitleModalOpen(false);
    setSaveTitleDraft("");
  };

  const handleCancelSaveChat = () => {
    setIsSaveTitleModalOpen(false);
    setSaveTitleDraft("");
  };

  const handleLoadSavedChat = (savedChat) => {
    setMessages(savedChat.messages);
    setPinnedMessageIds(savedChat.pinnedMessageIds ?? []);
    setDraft("");
    setIsMicActive(false);
    setActiveSavedChatId(savedChat.id);
    setIsPinnedNavigatorOpen(false);
    setIsSavedChatsOpen(false);
    setIsHelpOpen(false);
  };

  const handleStartNewChat = () => {
    setMessages([]);
    setDraft("");
    setPinnedMessageIds([]);
    setIsPinnedNavigatorOpen(false);
    setCurrentPinnedIndex(0);
    setIsMicActive(false);
    setActiveSavedChatId(null);
    setIsSavedChatsOpen(false);
    setIsHelpOpen(false);
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
    <div className={`appFrame ${isAsideOpen ? "rightAsideOpen" : ""}`}>
      <aside className="avatarPanel">
        <div className="assistantHead">
          <div className="assistantBadge">Care Companion</div>
        </div>

        <div className="avatarStage" aria-hidden="true">
          <div className="avatarGlow" />
          <div className="avatarCore">A</div>
        </div>

        <button
          type="button"
          className={`avatarMicButton ${isMicActive ? "active" : ""}`}
          aria-label={isMicActive ? "Stop microphone" : "Start microphone"}
          aria-pressed={isMicActive}
          onClick={handleToggleMicrophone}
          disabled={isReviewingSavedChat || !isSpeechSupported}
        >
          <img
            src={microphoneIcon}
            alt=""
            aria-hidden="true"
            className="microphoneIcon"
          />
        </button>

        <div className="assistantBubble">
          Hello, I'm here to support you. How can I assist you today?
        </div>
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
            {!isReviewingSavedChat && (
              <button
                type="button"
                className="headerSavedButton"
                aria-label="Save Chat"
                onClick={handleSaveChat}
              >
                <img
                  src={saveChatIcon}
                  alt=""
                  aria-hidden="true"
                  className="headerSavedIcon"
                />
              </button>
            )}
          </div>
        </header>

        <section className="conversation" aria-label="Chat history">
          {messages.map((message) => (
            <article key={message.id} className={`messageRow ${message.role}`}>
              {message.role === "assistant" && (
                <div className="messageAvatar">A</div>
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
                  {message.text}
                </div>
                <div className="messageTime">{message.time}</div>
              </div>
            </article>
          ))}
        </section>

        {isReviewingSavedChat && (
          <p className="reviewModeNotice" aria-live="polite">
            This is a saved conversation in read only mode. Start a new chat to
            continue messaging.
          </p>
        )}

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
              disabled={isReviewingSavedChat}
            />
            <button
              type="button"
              className="sendButton"
              aria-label="Send message"
              onClick={handleSend}
              disabled={isReviewingSavedChat}
            >
              ➤
            </button>
          </div>
        </section>
      </main>

      {isSaveTitleModalOpen && (
        <div className="saveTitleModalOverlay" role="presentation">
          <div
            className="saveTitleModal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="save-title-heading"
          >
            <h3 id="save-title-heading">Save Conversation</h3>
            <p className="saveTitleHint">Set a title for this conversation.</p>
            <input
              type="text"
              value={saveTitleDraft}
              onChange={(event) => setSaveTitleDraft(event.target.value)}
              placeholder="Conversation title"
              aria-label="Conversation title"
              autoFocus
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleConfirmSaveChat();
                }

                if (event.key === "Escape") {
                  event.preventDefault();
                  handleCancelSaveChat();
                }
              }}
            />
            <div className="saveTitleActions">
              <button
                type="button"
                className="saveTitleCancelButton"
                onClick={handleCancelSaveChat}
              >
                Cancel
              </button>
              <button
                type="button"
                className="saveTitleConfirmButton"
                onClick={handleConfirmSaveChat}
                disabled={!saveTitleDraft.trim()}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

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
            </section>
          ) : (
            <>
              <button
                type="button"
                className="newChatButton"
                aria-label="New Chat"
                onClick={handleStartNewChat}
              >
                New Chat
              </button>
              <button
                type="button"
                className="savedChatsButton"
                aria-label="Saved Chats"
                aria-expanded={isSavedChatsOpen}
                aria-controls="saved-conversations-list"
                onClick={() => setIsSavedChatsOpen(true)}
              >
                Saved Conversations
              </button>
              <button
                type="button"
                className="knowledgeGraphButton"
                aria-label="Knowledge Graph"
              >
                Knowledge Graph
              </button>
              <button
                type="button"
                className="helpButton"
                aria-expanded={isHelpOpen}
                aria-label="Help"
                onClick={() => setIsHelpOpen(true)}
              >
                Help
              </button>
            </>
          )}
        </div>
      </aside>

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
    </div>
  );
}

export default App;
