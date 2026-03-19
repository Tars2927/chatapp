import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import api from "../api/axios";
import ChatInput from "../components/ChatInput";
import MessageBubble from "../components/MessageBubble";
import Navbar from "../components/Navbar";

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

export default function Chat() {
  const navigate = useNavigate();
  const user = readStoredUser();
  const messageEndRef = useRef(null);
  const socketRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [error, setError] = useState("");

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

    const apiUrl = new URL(import.meta.env.VITE_API_URL || "http://127.0.0.1:8000");
    const protocol = apiUrl.protocol === "https:" ? "wss:" : "ws:";
    const socketUrl = `${protocol}//${apiUrl.host}/ws/${user.id}?token=${encodeURIComponent(token)}`;
    const socket = new WebSocket(socketUrl);

    socketRef.current = socket;

    socket.onopen = () => {
      setIsSocketConnected(true);
      setError("");
    };

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === "message" && payload.message) {
          setMessages((current) => [...current, payload.message]);
        }
      } catch {
        setError("Received an unreadable message from the websocket connection.");
      }
    };

    socket.onerror = () => {
      setError("Realtime connection failed. Refresh the page and try again.");
    };

    socket.onclose = () => {
      setIsSocketConnected(false);
    };

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [user?.id]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleLogout() {
    socketRef.current?.close();
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login", { replace: true });
  }

  function handleSend(content) {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      setError("Socket is not connected yet. Wait a moment and try again.");
      return;
    }

    socketRef.current.send(JSON.stringify({ content }));
  }

  return (
    <main className="chat-shell">
      <Navbar
        user={user}
        connectionLabel={isSocketConnected ? "Realtime connected" : "Connecting..."}
        onLogout={handleLogout}
      />

      <section className="chat-panel live">
        {error ? <p className="form-error">{error}</p> : null}

        {isLoading ? (
          <p className="chat-copy">Loading recent messages...</p>
        ) : (
          <div className="message-list">
            {messages.length ? (
              messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isOwnMessage={message.sender_id === user?.id}
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

        <ChatInput disabled={!isSocketConnected} onSend={handleSend} />
      </section>
    </main>
  );
}
