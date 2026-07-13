import { useEffect, useRef, useState } from "react";
import sidebarIcon from "../assets/icons/sidebar.svg";
import microphoneIcon from "../assets/icons/microphone.svg";
import pinMessageIcon from "../assets/icons/pinMessage.svg";
import saveChatIcon from "../assets/icons/saveChat.svg";
import trashBinIcon from "../assets/icons/trashBin.svg";
import leftArrowIcon from "../assets/icons/leftArrow.svg";
import newChatIcon from "../assets/icons/newChat.svg";
import knowledgeGraphIcon from "../assets/icons/knowledgeGraph.svg";
import helpIcon from "../assets/icons/help.svg";

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

const getMicErrorMessage = (errorCode) => {
  if (errorCode === "not-allowed" || errorCode === "service-not-allowed") {
    return "Microphone access was blocked. Please allow microphone access and try again.";
  }

  if (errorCode === "audio-capture") {
    return "No microphone could be accessed. Check that a microphone is connected and available.";
  }

  return "The microphone could not be accessed. Please try again.";
};

function App() {
  const [hasUsedMicOnce, setHasUsedMicOnce] = useState(false);
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [isAsideOpen, setIsAsideOpen] = useState(true);
  const [isMicActive, setIsMicActive] = useState(false);
  const [isSpeechSupported, setIsSpeechSupported] = useState(true);
  const [micError, setMicError] = useState("");
  const [pinnedMessageIds, setPinnedMessageIds] = useState([]);
  const [savedChats, setSavedChats] = useState([]);
  const [isSaveTitleModalOpen, setIsSaveTitleModalOpen] = useState(false);
  const [saveTitleDraft, setSaveTitleDraft] = useState("");
  const [isNewChatPromptOpen, setIsNewChatPromptOpen] = useState(false);
  const [startNewChatAfterSave, setStartNewChatAfterSave] = useState(false);
  const [pendingDeleteSavedChat, setPendingDeleteSavedChat] = useState(null);
  const [activeSavedChatId, setActiveSavedChatId] = useState(null);
  const [isSavedChatsOpen, setIsSavedChatsOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isKnowledgeGraphOpen, setIsKnowledgeGraphOpen] = useState(false);
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
      setMicError("Microphone input is not supported in this browser.");
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

    recognition.onerror = (event) => {
      setIsMicActive(false);

      if (event?.error === "aborted") {
        return;
      }

      setMicError(getMicErrorMessage(event?.error));
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
      setIsMicActive(false);
    }

    setMicError("");

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
      setMicError("");
      return;
    }

    speechBaseDraftRef.current = draft.trim();
    speechFinalTranscriptRef.current = "";
    setMicError("");

    try {
      recognitionRef.current.start();
      setIsMicActive(true);

      if (!hasUsedMicOnce) {
        setHasUsedMicOnce(true);
      }
    } catch {
      setIsMicActive(false);
      setMicError("The microphone could not be accessed. Please try again.");
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
    setStartNewChatAfterSave(false);
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

    if (startNewChatAfterSave) {
      setStartNewChatAfterSave(false);
      setMessages([]);
      setDraft("");
      setPinnedMessageIds([]);
      setIsPinnedNavigatorOpen(false);
      setCurrentPinnedIndex(0);
      setIsMicActive(false);
      setActiveSavedChatId(null);
      setIsSavedChatsOpen(false);
      setIsHelpOpen(false);
      setIsKnowledgeGraphOpen(false);
    }
  };

  const handleCancelSaveChat = () => {
    setIsSaveTitleModalOpen(false);
    setSaveTitleDraft("");
    setStartNewChatAfterSave(false);
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
    setIsKnowledgeGraphOpen(false);
  };

  const handleExecuteNewChat = () => {
    setMessages([]);
    setDraft("");
    setPinnedMessageIds([]);
    setIsPinnedNavigatorOpen(false);
    setCurrentPinnedIndex(0);
    setIsMicActive(false);
    setActiveSavedChatId(null);
    setIsSavedChatsOpen(false);
    setIsHelpOpen(false);
    setIsKnowledgeGraphOpen(false);
  };

  const handleStartNewChat = () => {
    setIsNewChatPromptOpen(true);
  };

  const handleCancelNewChatPrompt = () => {
    setIsNewChatPromptOpen(false);
  };

  const handleStartNewChatWithoutSave = () => {
    setIsNewChatPromptOpen(false);
    handleExecuteNewChat();
  };

  const handleSaveAndStartNewChat = () => {
    setIsNewChatPromptOpen(false);
    setStartNewChatAfterSave(true);
    setSaveTitleDraft("");
    setIsSaveTitleModalOpen(true);
  };

  const handleOpenSavedChats = () => {
    setIsSavedChatsOpen(true);
    setIsHelpOpen(false);
    setIsKnowledgeGraphOpen(false);
    setIsAsideOpen(true);
  };

  const handleOpenHelp = () => {
    setIsHelpOpen(true);
    setIsSavedChatsOpen(false);
    setIsKnowledgeGraphOpen(false);
    setIsAsideOpen(true);
  };

  const handleOpenKnowledgeGraph = () => {
    setIsKnowledgeGraphOpen(true);
    setIsSavedChatsOpen(false);
    setIsHelpOpen(false);
    setIsAsideOpen(true);
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
      className={`appFrame ${isAsideOpen ? "rightAsideOpen" : ""} ${
        isMicActive ? "micExpanded" : ""
      }`}
    >
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

        {micError && (
          <p className="micErrorNotice" role="alert" aria-live="polite">
            {micError}
          </p>
        )}

        {!hasUsedMicOnce && (
          <div className="assistantBubble">
            Hello, I'm here to support you. How can I assist you today?
          </div>
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

      {isNewChatPromptOpen && (
        <div className="saveTitleModalOverlay" role="presentation">
          <div
            className="saveTitleModal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-chat-confirm-heading"
          >
            <h3 id="new-chat-confirm-heading">Start New Chat?</h3>
            <p className="saveTitleHint">
              Do you want to save your current chat before starting a new one?
            </p>
            <div className="saveTitleActions">
              <button
                type="button"
                className="saveTitleCancelButton"
                onClick={handleCancelNewChatPrompt}
              >
                Cancel
              </button>
              <button
                type="button"
                className="deleteConfirmButton"
                onClick={handleStartNewChatWithoutSave}
              >
                New Chat Without Saving
              </button>
              <button
                type="button"
                className="saveTitleConfirmButton"
                onClick={handleSaveAndStartNewChat}
              >
                Save And Start New Chat
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
                  Choosing an assistant: By clicking on the left or right
                  profile picture of the assistant, you can choose which
                  assistant you want to talk to.
                </li>
                <li>
                  Sending Messages: Underneath the assistant, you can find the
                  microphone. It activates by clicking on it. Please speak while
                  it's pulsating in red. When you have stopped talking click on
                  it again and verify in the textfield, if the text is correct.
                  If not, you can edit it and then click the send button on the
                  right side of the textfield. You can also send a message by
                  typing it in the textfield and pressing enter or clicking the
                  send button.
                </li>
                <li>
                  Pinning a Message: You can pin a message from the assistant by
                  hovering over the message and clicking the pin symbol on the
                  top right corner that appears when hovering over the
                  assistant's message. To see all the pinned messages you can
                  click on the pin symbol on the top right corner of the
                  Conversation panel (left from the save button). You can
                  navigate through the pinned messages by clicking on the up and
                  down arrows next to the pin symbol.
                </li>
                <li>
                  Saving a Chat: You can save a chat by clicking the floppy
                  disk/save button to the top right corner of the
                  Conversation-panel
                </li>
                <li>
                  Options: you can open a new chat by clicking the "New Chat"
                  button in the right sidebar - you can access saved
                  conversations by clicking the "Saved Conversations" button
                  underneath it. - you can access the knowledge graph by
                  clicking the "Knowledge Graph" button underneath it.
                </li>
              </ul>
            </section>
          ) : isKnowledgeGraphOpen ? (
            <section className="helpView" aria-label="Knowledge Graph">
              <div className="helpViewHeader">
                <h4>Knowledge Graph</h4>
                <button
                  type="button"
                  className="helpCloseButton"
                  aria-label="Back to options"
                  onClick={() => setIsKnowledgeGraphOpen(false)}
                >
                  <img
                    src={leftArrowIcon}
                    alt=""
                    aria-hidden="true"
                    className="helpCloseIcon"
                  />
                </button>
              </div>

              <p className="helpIntro">Knowledge Graph contentg here.</p>
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
                onClick={handleOpenSavedChats}
              >
                Saved Conversations
              </button>
              <button
                type="button"
                className="knowledgeGraphButton"
                aria-label="Knowledge Graph"
                onClick={handleOpenKnowledgeGraph}
              >
                Knowledge Graph
              </button>
              <button
                type="button"
                className="helpButton"
                aria-expanded={isHelpOpen}
                aria-label="Help"
                onClick={handleOpenHelp}
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
