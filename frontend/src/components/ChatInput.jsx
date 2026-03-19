import { useState } from "react";

export default function ChatInput({ disabled, onSend }) {
  const [content, setContent] = useState("");

  function handleSubmit(event) {
    event.preventDefault();

    const trimmed = content.trim();
    if (!trimmed) {
      return;
    }

    onSend(trimmed);
    setContent("");
  }

  return (
    <form className="chat-input-bar" onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Write a message to the room..."
        value={content}
        onChange={(event) => setContent(event.target.value)}
        disabled={disabled}
      />

      <button type="submit" className="primary-button" disabled={disabled}>
        Send
      </button>
    </form>
  );
}
