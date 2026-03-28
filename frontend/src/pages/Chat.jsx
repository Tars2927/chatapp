import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import api from "../api/axios";
import ChatInput from "../components/ChatInput";
import MessageBubble from "../components/MessageBubble";
import Navbar from "../components/Navbar";

const TYPING_TIMEOUT_MS = 2000;
const RECONNECT_DELAY_MS = 1500;
const APP_TITLE = "Baithak";
const BROWSER_ALERTS_STORAGE_KEY = "baithak-browser-alerts-enabled";

function getNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }

  return window.Notification.permission;
}

function resolveApiUrl() {
  const configuredUrl = import.meta.env.VITE_API_URL?.trim();

  if (configuredUrl) {
    return configuredUrl.replace(/\/+$/, "");
  }

  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return "http://127.0.0.1:8000";
}

function resolveMediaUrl(value) {
  if (!value) {
    return null;
  }

  if (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("data:") ||
    value.startsWith("blob:")
  ) {
    return value;
  }

  const normalizedPath = value.startsWith("/") ? value : `/${value}`;
  return `${resolveApiUrl()}${normalizedPath}`;
}

function normalizeUser(user) {
  if (!user) {
    return null;
  }

  return {
    ...user,
    avatar_url: resolveMediaUrl(user.avatar_url),
  };
}

function normalizeMessage(message) {
  if (!message) {
    return null;
  }

  return {
    ...message,
    file_url: resolveMediaUrl(message.file_url),
    sender: normalizeUser(message.sender),
  };
}

function readStoredUser() {
  const rawUser = localStorage.getItem("user");

  if (!rawUser) {
    return null;
  }

  try {
    return JSON.parse(rawUser);
  } catch {
    return null;
  }
}

function readTokenUserId(token) {
  if (!token) {
    return null;
  }

  try {
    const [, payload] = token.split(".");
    if (!payload) {
      return null;
    }

    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = window.atob(normalized);
    const parsed = JSON.parse(decoded);
    const sub = Number(parsed.sub);
    return Number.isNaN(sub) ? null : sub;
  } catch {
    return null;
  }
}

function readLatestMessageId(messageList) {
  return messageList.length ? messageList[messageList.length - 1].id : null;
}

function readStoredBrowserAlertsEnabled() {
  if (typeof window === "undefined") {
    return true;
  }

  const storedValue = window.localStorage.getItem(BROWSER_ALERTS_STORAGE_KEY);
  return storedValue !== "false";
}

export default function Chat({ theme, onToggleTheme }) {
  const navigate = useNavigate();
  const messageEndRef = useRef(null);
  const avatarInputRef = useRef(null);
  const socketRef = useRef(null);
  const connectionAttemptRef = useRef(0);
  const reconnectTimeoutRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const sentTypingRef = useRef(false);
  const manuallyClosedRef = useRef(false);
  const latestMessageIdRef = useRef(null);
  const lastReadMessageIdRef = useRef(null);
  const unreadCountRef = useRef(0);
  const readRequestInFlightRef = useRef(false);
  const notificationsRef = useRef([]);
  const [currentUser, setCurrentUser] = useState(() => normalizeUser(readStoredUser()));
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [connectionState, setConnectionState] = useState("Connecting...");
  const [typingUsers, setTypingUsers] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationPermission, setNotificationPermission] = useState(
    getNotificationPermission(),
  );
  const [browserAlertsEnabled, setBrowserAlertsEnabled] = useState(
    readStoredBrowserAlertsEnabled(),
  );
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState(true);
  const [digestMinUnreadCount, setDigestMinUnreadCount] = useState(1);
  const [digestPreview, setDigestPreview] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeSidebarPanel, setActiveSidebarPanel] = useState("workspace");
  const [isUpdatingEmailNotifications, setIsUpdatingEmailNotifications] = useState(false);
  const [isAvatarUpdating, setIsAvatarUpdating] = useState(false);
  const [error, setError] = useState("");
  const notificationSupported = notificationPermission !== "unsupported";

  function isChatActive() {
    if (typeof document === "undefined" || typeof window === "undefined") {
      return false;
    }

    return document.visibilityState === "visible" && document.hasFocus();
  }

  function persistUser(nextUser) {
    const normalizedUser = normalizeUser(nextUser);

    if (!normalizedUser) {
      localStorage.removeItem("user");
      setCurrentUser(null);
      return null;
    }

    localStorage.setItem("user", JSON.stringify(normalizedUser));
    setCurrentUser(normalizedUser);
    return normalizedUser;
  }

  function updateStoredUserReadState(lastReadMessageId) {
    setCurrentUser((existingUser) => {
      if (!existingUser) {
        return existingUser;
      }

      const nextUser = {
        ...existingUser,
        last_read_message_id: lastReadMessageId,
      };
      localStorage.setItem("user", JSON.stringify(nextUser));
      return nextUser;
    });
  }

  function syncCurrentUserAvatar(nextUser) {
    const normalizedUser = persistUser(nextUser);
    if (!normalizedUser) {
      return;
    }

    setMessages((current) =>
      current.map((message) =>
        message.sender_id === normalizedUser.id
          ? {
              ...message,
              sender: {
                ...message.sender,
                username: normalizedUser.username,
                avatar_url: normalizedUser.avatar_url,
              },
            }
          : message,
      ),
    );
  }

  function applySummary(summary) {
    const nextUnreadCount = summary?.unread_count || 0;
    const nextLastReadMessageId = summary?.last_read_message_id ?? null;
    const nextLastMessageId = summary?.last_message_id ?? latestMessageIdRef.current;

    unreadCountRef.current = nextUnreadCount;
    lastReadMessageIdRef.current = nextLastReadMessageId;
    latestMessageIdRef.current = nextLastMessageId;
    setUnreadCount(nextUnreadCount);
    updateStoredUserReadState(nextLastReadMessageId);
  }

  function closeNotifications() {
    notificationsRef.current.forEach((notification) => notification.close());
    notificationsRef.current = [];
  }

  function showBrowserNotification(message) {
    if (
      !notificationSupported ||
      notificationPermission !== "granted" ||
      !browserAlertsEnabled ||
      message.sender_id === currentUser?.id
    ) {
      return;
    }

    const body = message.file_url
      ? `${message.sender?.username || "Someone"} sent an attachment`
      : message.content || "New message";

    const notification = new window.Notification(
      `${message.sender?.username || "Someone"} on Baithak`,
      {
        body,
        tag: `baithak-message-${message.id}`,
      },
    );

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    notificationsRef.current.push(notification);
    notification.onclose = () => {
      notificationsRef.current = notificationsRef.current.filter((entry) => entry !== notification);
    };
  }

  async function refreshSummary() {
    const response = await api.get("/messages/summary");
    applySummary(response.data);
    return response.data;
  }

  async function refreshDigestPreview() {
    const response = await api.get("/me/digest-preview");
    setDigestPreview(response.data);
    return response.data;
  }

  async function refreshNotificationSettings() {
    const [preferencesResponse, digestResponse] = await Promise.all([
      api.get("/me/notifications"),
      api.get("/me/digest-preview"),
    ]);

    setEmailNotificationsEnabled(preferencesResponse.data.email_notifications_enabled);
    setDigestMinUnreadCount(preferencesResponse.data.digest_min_unread_count || 1);
    setDigestPreview(digestResponse.data);

    return {
      preferences: preferencesResponse.data,
      digestPreview: digestResponse.data,
    };
  }

  async function markMessagesRead(targetMessageId) {
    if (!currentUser?.id || !isChatActive()) {
      return;
    }

    const nextTargetId = targetMessageId ?? latestMessageIdRef.current;
    if (!nextTargetId || readRequestInFlightRef.current) {
      return;
    }

    if (
      unreadCountRef.current === 0 &&
      lastReadMessageIdRef.current !== null &&
      nextTargetId <= lastReadMessageIdRef.current
    ) {
      return;
    }

    readRequestInFlightRef.current = true;

    try {
      const response = await api.patch("/messages/read", {
        last_read_message_id: nextTargetId,
      });
      applySummary(response.data);
    } catch {
      // Avoid surfacing noisy read-sync failures while the user is chatting.
    } finally {
      readRequestInFlightRef.current = false;
    }
  }

  function appendMessage(nextMessage) {
    latestMessageIdRef.current = Math.max(latestMessageIdRef.current || 0, nextMessage.id);

    setMessages((current) => {
      if (current.some((message) => message.id === nextMessage.id)) {
        return current;
      }
      return [...current, nextMessage];
    });
  }

  function replaceMessage(nextMessage) {
    setMessages((current) =>
      current.map((message) => (message.id === nextMessage.id ? nextMessage : message)),
    );
  }

  function removeMessage(messageId) {
    setMessages((current) => current.filter((message) => message.id !== messageId));
  }

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      BROWSER_ALERTS_STORAGE_KEY,
      browserAlertsEnabled ? "true" : "false",
    );
  }, [browserAlertsEnabled]);

  useEffect(() => {
    if (!notificationSupported) {
      return undefined;
    }

    function syncNotificationPermission() {
      setNotificationPermission(getNotificationPermission());
    }

    window.addEventListener("focus", syncNotificationPermission);

    return () => {
      window.removeEventListener("focus", syncNotificationPermission);
    };
  }, [notificationSupported]);

  useEffect(() => {
    let isMounted = true;

    async function loadChatData() {
      try {
        const [messagesResponse, summaryResponse] = await Promise.all([
          api.get("/messages"),
          api.get("/messages/summary"),
        ]);
        const notificationData = await refreshNotificationSettings();

        if (!isMounted) {
          return;
        }

        const nextMessages = (messagesResponse.data || []).map(normalizeMessage);
        setMessages(nextMessages);
        latestMessageIdRef.current =
          summaryResponse.data?.last_message_id ?? readLatestMessageId(nextMessages);
        applySummary(summaryResponse.data);
        setEmailNotificationsEnabled(notificationData.preferences.email_notifications_enabled);
        setDigestPreview(notificationData.digestPreview);

        if (isChatActive()) {
          await markMessagesRead(latestMessageIdRef.current);
        }
      } catch (requestError) {
        if (!isMounted) {
          return;
        }

        setError(
          requestError.response?.data?.detail ||
            "Could not load previous messages. Check the backend and try again.",
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadChatData();

    return () => {
      isMounted = false;
    };
  }, [currentUser?.id]);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token || !currentUser?.id) {
      return undefined;
    }

    const tokenUserId = readTokenUserId(token);
    if (tokenUserId !== Number(currentUser.id)) {
      setIsSocketConnected(false);
      setConnectionState("Session error");
      setError("Your saved session is out of sync. Please log out and sign in again.");
      return undefined;
    }

    manuallyClosedRef.current = false;
    const connectionAttempt = connectionAttemptRef.current + 1;
    connectionAttemptRef.current = connectionAttempt;

    function clearReconnectTimer() {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    }

    function addTypingUser(payload) {
      if (!payload.username || payload.user_id === currentUser.id) {
        return;
      }

      setTypingUsers((current) => {
        const next = current.filter((entry) => entry.user_id !== payload.user_id);
        return [...next, { user_id: payload.user_id, username: payload.username }];
      });

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = setTimeout(() => {
        setTypingUsers((current) =>
          current.filter((entry) => entry.user_id !== payload.user_id),
        );
      }, TYPING_TIMEOUT_MS);
    }

    function connectSocket() {
      const apiUrl = new URL(resolveApiUrl());
      const protocol = apiUrl.protocol === "https:" ? "wss:" : "ws:";
      const socketUrl = `${protocol}//${apiUrl.host}/ws/${currentUser.id}?token=${encodeURIComponent(token)}`;
      const socket = new WebSocket(socketUrl);

      socketRef.current = socket;
      setConnectionState("Connecting...");

      socket.onopen = () => {
        if (connectionAttemptRef.current !== connectionAttempt) {
          socket.close();
          return;
        }

        clearReconnectTimer();
        setIsSocketConnected(true);
        setConnectionState("Realtime connected");
        setError("");
      };

      socket.onmessage = (event) => {
        if (connectionAttemptRef.current !== connectionAttempt) {
          return;
        }

        try {
          const payload = JSON.parse(event.data);

          if (payload.type === "connection_established") {
            refreshSummary().catch(() => {});
            refreshDigestPreview().catch(() => {});
            return;
          }

          if (payload.type === "message" && payload.message) {
            const nextMessage = normalizeMessage(payload.message);
            appendMessage(nextMessage);

            if (payload.message.sender_id === currentUser.id) {
              return;
            }

            if (isChatActive()) {
              closeNotifications();
              markMessagesRead(nextMessage.id);
            } else {
              unreadCountRef.current += 1;
              setUnreadCount(unreadCountRef.current);
              showBrowserNotification(nextMessage);
              refreshDigestPreview().catch(() => {});
            }

            return;
          }

          if (payload.type === "message_updated" && payload.message) {
            replaceMessage(normalizeMessage(payload.message));
            return;
          }

          if (payload.type === "message_deleted" && payload.message_id) {
            removeMessage(payload.message_id);
            refreshSummary().catch(() => {});
            refreshDigestPreview().catch(() => {});
            return;
          }

          if (payload.type === "typing") {
            addTypingUser(payload);
            return;
          }

          if (payload.type === "presence") {
            setOnlineUsers(payload.online_users || []);
          }
        } catch {
          setError("Received an unreadable message from the websocket connection.");
        }
      };

      socket.onerror = () => {
        if (connectionAttemptRef.current !== connectionAttempt) {
          return;
        }

        setError("Realtime connection hit a problem. Reconnecting...");
      };

      socket.onclose = (event) => {
        if (connectionAttemptRef.current !== connectionAttempt) {
          return;
        }

        setIsSocketConnected(false);
        socketRef.current = null;

        if (manuallyClosedRef.current) {
          setConnectionState("Offline");
          return;
        }

        if (event.code === 1008) {
          setConnectionState("Session error");
          setError(event.reason || "Your chat session was rejected. Please sign in again.");
          return;
        }

        setConnectionState("Reconnecting...");
        reconnectTimeoutRef.current = setTimeout(connectSocket, RECONNECT_DELAY_MS);
      };
    }

    connectSocket();

    return () => {
      manuallyClosedRef.current = true;
      connectionAttemptRef.current += 1;
      clearReconnectTimer();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [currentUser?.id]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    document.title = unreadCount > 0 ? `(${unreadCount}) ${APP_TITLE}` : APP_TITLE;

    return () => {
      document.title = APP_TITLE;
    };
  }, [unreadCount]);

  useEffect(() => {
    function handleAttentionChange() {
      if (!isChatActive()) {
        return;
      }

      closeNotifications();
      markMessagesRead(latestMessageIdRef.current);
    }

    window.addEventListener("focus", handleAttentionChange);
    document.addEventListener("visibilitychange", handleAttentionChange);

    return () => {
      window.removeEventListener("focus", handleAttentionChange);
      document.removeEventListener("visibilitychange", handleAttentionChange);
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }

    document.body.classList.add("chat-page-active");

    return () => {
      document.body.classList.remove("chat-page-active");
    };
  }, []);

  useEffect(() => {
    return () => {
      closeNotifications();
    };
  }, []);

  async function handleEnableNotifications() {
    if (!notificationSupported || notificationPermission === "granted") {
      return;
    }

    try {
      const result = await window.Notification.requestPermission();
      setNotificationPermission(result);
    } catch {
      setError("Could not request browser notification permission.");
    }
  }

  function handleBrowserAlertsToggle() {
    setBrowserAlertsEnabled((current) => {
      const nextValue = !current;
      if (!nextValue) {
        closeNotifications();
      }
      return nextValue;
    });
  }

  async function updateEmailNotificationSettings(nextValue) {
    setIsUpdatingEmailNotifications(true);
    setError("");

    try {
      const response = await api.patch("/me/notifications", {
        email_notifications_enabled: nextValue,
        digest_min_unread_count: digestMinUnreadCount,
      });
      setEmailNotificationsEnabled(response.data.email_notifications_enabled);
      setDigestMinUnreadCount(response.data.digest_min_unread_count || 1);
      await refreshDigestPreview();
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail ||
          "Could not update email reminder settings right now.",
      );
    } finally {
      setIsUpdatingEmailNotifications(false);
    }
  }

  function handleEmailNotificationToggle() {
    return updateEmailNotificationSettings(!emailNotificationsEnabled);
  }

  function handleSaveDigestThreshold() {
    return updateEmailNotificationSettings(emailNotificationsEnabled);
  }

  function handleSelectSidebarPanel(panel) {
    if (isSidebarOpen && activeSidebarPanel === panel) {
      setIsSidebarOpen(false);
      return;
    }

    setActiveSidebarPanel(panel);
    setIsSidebarOpen(true);
  }

  function openAvatarPicker() {
    avatarInputRef.current?.click();
  }

  async function handleAvatarFileChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setIsAvatarUpdating(true);
    setError("");

    try {
      const response = await api.post("/me/avatar", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      syncCurrentUserAvatar(response.data);
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail ||
          "Could not update your avatar right now.",
      );
    } finally {
      setIsAvatarUpdating(false);
    }
  }

  async function handleAvatarRemove() {
    if (!currentUser?.avatar_url) {
      return;
    }

    setIsAvatarUpdating(true);
    setError("");

    try {
      const response = await api.delete("/me/avatar");
      syncCurrentUserAvatar(response.data);
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail ||
          "Could not remove your avatar right now.",
      );
    } finally {
      setIsAvatarUpdating(false);
    }
  }

  function handleLogout() {
    manuallyClosedRef.current = true;
    socketRef.current?.close();
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setCurrentUser(null);
    setIsSidebarOpen(false);
    navigate("/login", { replace: true });
  }

  function handleSend(content) {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      setError("Socket is not connected yet. Wait a moment and try again.");
      return false;
    }

    setError("");
    socketRef.current.send(JSON.stringify({ content }));
    return true;
  }

  function handleEditMessage(messageId, content) {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      setError("Socket is not connected yet. Wait a moment and try again.");
      return false;
    }

    setError("");
    socketRef.current.send(JSON.stringify({ type: "edit_message", message_id: messageId, content }));
    return true;
  }

  function handleDeleteMessage(messageId) {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      setError("Socket is not connected yet. Wait a moment and try again.");
      return false;
    }

    setError("");
    socketRef.current.send(JSON.stringify({ type: "delete_message", message_id: messageId }));
    return true;
  }

  function handleTyping(value) {
    if (!value.trim()) {
      sentTypingRef.current = false;
      return;
    }

    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    if (sentTypingRef.current) {
      return;
    }

    sentTypingRef.current = true;
    socketRef.current.send(JSON.stringify({ type: "typing" }));

    window.setTimeout(() => {
      sentTypingRef.current = false;
    }, 900);
  }

  async function handleFileSelect(file) {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      setError("Socket is not connected yet. Wait a moment and try again.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setIsUploading(true);
    setError("");

    try {
      const response = await api.post("/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      const fileUrl = resolveMediaUrl(response.data.file_url);

      socketRef.current.send(
        JSON.stringify({
          file_url: fileUrl,
          file_type: response.data.file_type,
          content: "",
        }),
      );
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail ||
          "Upload failed. Please check your file and try again.",
      );
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <main className="chat-shell">
      <Navbar
        user={currentUser}
        connectionLabel={connectionState}
        onlineUsers={onlineUsers}
        unreadCount={unreadCount}
        theme={theme}
        notificationSupported={notificationSupported}
        notificationPermission={notificationPermission}
        browserAlertsEnabled={browserAlertsEnabled}
        emailNotificationsEnabled={emailNotificationsEnabled}
        digestMinUnreadCount={digestMinUnreadCount}
        digestPreview={digestPreview}
        isUpdatingEmailNotifications={isUpdatingEmailNotifications}
        isAvatarUpdating={isAvatarUpdating}
        isSidebarOpen={isSidebarOpen}
        activePanel={activeSidebarPanel}
        onCloseSidebar={() => setIsSidebarOpen(false)}
        onSelectPanel={handleSelectSidebarPanel}
        onEnableNotifications={handleEnableNotifications}
        onToggleBrowserAlerts={handleBrowserAlertsToggle}
        onEmailNotificationToggle={handleEmailNotificationToggle}
        onDigestMinUnreadCountChange={setDigestMinUnreadCount}
        onSaveDigestThreshold={handleSaveDigestThreshold}
        onOpenAvatarPicker={openAvatarPicker}
        onAvatarRemove={handleAvatarRemove}
        onToggleTheme={onToggleTheme}
        onLogout={handleLogout}
      />

      <section className="chat-main">
        <div className="chat-scroll-shell">
          <header className="chat-topbar">
            <div className="chat-topbar-main">
              <button
                type="button"
                className="secondary-button chat-topbar-menu"
                onClick={() => handleSelectSidebarPanel("workspace")}
              >
                Menu
              </button>

              <div>
                <p className="eyebrow">Baithak Room</p>
                <h1>Baithak</h1>
                <p className="chat-subtitle">
                  {onlineUsers.length} online now
                </p>
              </div>
            </div>

            <div className="chat-topbar-status">
              <span className="chat-topbar-pill">{connectionState}</span>
              {unreadCount > 0 ? (
                <span className="chat-topbar-pill unread">
                  {unreadCount} unread
                </span>
              ) : null}
            </div>
          </header>

          <section className="chat-panel live">
            <div className="chat-conversation">
              {error ? <p className="form-error chat-panel-alert">{error}</p> : null}

              <div className="chat-thread">
                {isLoading ? (
                  <div className="chat-status-card">
                    <p className="chat-copy">Loading recent messages...</p>
                  </div>
                ) : (
                  <div className="message-list">
                    {messages.length ? (
                      messages.map((message) => (
                        <MessageBubble
                          key={message.id}
                          message={message}
                          isOwnMessage={message.sender_id === currentUser?.id}
                          onEdit={handleEditMessage}
                          onDelete={handleDeleteMessage}
                        />
                      ))
                    ) : (
                      <div className="chat-empty">
                        <p className="chat-copy">No messages yet. Start the room with the first one.</p>
                      </div>
                    )}
                    <div ref={messageEndRef} />
                  </div>
                )}
              </div>

              <div className="chat-footer-meta">
                <p className="typing-indicator">
                  {typingUsers.length
                    ? `${typingUsers.map((entry) => entry.username).join(", ")} typing...`
                    : unreadCount > 0
                      ? `${unreadCount} unread message${unreadCount === 1 ? "" : "s"} waiting.`
                      : onlineUsers.length > 1
                        ? `${onlineUsers.length} users online.`
                        : isSocketConnected
                          ? "Room is live."
                          : "Waiting for connection..."}
                </p>
              </div>
            </div>
          </section>
        </div>

        <ChatInput
          disabled={!isSocketConnected}
          isUploading={isUploading}
          onFileSelect={handleFileSelect}
          onSend={handleSend}
          onTyping={handleTyping}
        />
      </section>

      <input
        ref={avatarInputRef}
        className="visually-hidden"
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        onChange={handleAvatarFileChange}
      />
    </main>
  );
}
