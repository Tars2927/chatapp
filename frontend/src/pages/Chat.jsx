import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import api from "../api/axios";
import ChatInput from "../components/ChatInput";
import MessageBubble from "../components/MessageBubble";
import Navbar from "../components/Navbar";

const TYPING_TIMEOUT_MS = 2000;
const RECONNECT_DELAY_MS = 1500;

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

export default function Chat() {
  const navigate = useNavigate();
  const user = readStoredUser();
  const messageEndRef = useRef(null);
  const socketRef = useRef(null);
  const connectionAttemptRef = useRef(0);
  const reconnectTimeoutRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const sentTypingRef = useRef(false);
  const manuallyClosedRef = useRef(false);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [connectionState, setConnectionState] = useState("Connecting...");
  const [typingUsers, setTypingUsers] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [error, setError] = useState("");

  function appendMessage(nextMessage) {
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
    async function loadMessages() {
      try {
        const response = await api.get("/messages");
        setMessages(response.data);
      } catch (requestError) {
        setError(
          requestError.response?.data?.detail ||
            "Could not load previous messages. Check the backend and try again.",
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadMessages();
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token || !user?.id) {
      return undefined;
    }

    const tokenUserId = readTokenUserId(token);
    if (tokenUserId !== Number(user.id)) {
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
      if (!payload.username || payload.user_id === user.id) {
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
      const socketUrl = `${protocol}//${apiUrl.host}/ws/${user.id}?token=${encodeURIComponent(token)}`;
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
          if (payload.type === "message" && payload.message) {
            appendMessage(payload.message);
            return;
          }

          if (payload.type === "message_updated" && payload.message) {
            replaceMessage(payload.message);
            return;
          }

          if (payload.type === "message_deleted" && payload.message_id) {
            removeMessage(payload.message_id);
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
  }, [user?.id]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleLogout() {
    manuallyClosedRef.current = true;
    socketRef.current?.close();
    localStorage.removeItem("token");
    localStorage.removeItem("user");
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

      const fileUrl = response.data.file_url?.startsWith("http")
        ? response.data.file_url
        : `${resolveApiUrl()}${response.data.file_url}`;

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
        user={user}
        connectionLabel={connectionState}
        onlineUsers={onlineUsers}
        onLogout={handleLogout}
      />

      <section className="chat-panel live">
        {error ? <p className="form-error">{error}</p> : null}

        {isLoading ? (
          <div className="chat-status-card">
            <p className="chat-copy">Loading recent messages...</p>
          </div>
        ) : (
          <>
            <div className="message-list">
              {messages.length ? (
                messages.map((message) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    isOwnMessage={message.sender_id === user?.id}
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

            <div className="chat-footer-meta">
              <p className="typing-indicator">
                {typingUsers.length
                  ? `${typingUsers.map((entry) => entry.username).join(", ")} typing...`
                  : onlineUsers.length > 1
                    ? `${onlineUsers.length} users online.`
                    : isSocketConnected
                      ? "Room is live."
                      : "Waiting for connection..."}
              </p>
            </div>
          </>
        )}

        <ChatInput
          disabled={!isSocketConnected}
          isUploading={isUploading}
          onFileSelect={handleFileSelect}
          onSend={handleSend}
          onTyping={handleTyping}
        />
      </section>
    </main>
  );
}
