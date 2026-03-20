import { useMemo, useState } from "react";

import FileUpload from "./FileUpload";

const EMOJIS = ["😀", "😂", "❤️", "🔥", "👍", "🙏", "🎉", "😎", "🤝", "😊"];

export default function ChatInput({
  disabled,
  isUploading,
  onFileSelect,
  onSend,
  onTyping,
}) {
  const [content, setContent] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const isSubmitDisabled = useMemo(
    () => disabled || isUploading || !content.trim(),
    [content, disabled, isUploading],
  );

  function handleSubmit(event) {
    event.preventDefault();

    const trimmed = content.trim();
    if (!trimmed) {
      return;
    }

    const didSend = onSend(trimmed);
    if (didSend !== false) {
      setContent("");
      setShowEmojiPicker(false);
    }
  }

  function handleChange(event) {
    setContent(event.target.value);
    onTyping?.(event.target.value);
  }

  function appendEmoji(emoji) {
    const nextValue = `${content}${emoji}`;
    setContent(nextValue);
    onTyping?.(nextValue);
  }

  return (
    <div className="chat-input-stack">
      {showEmojiPicker ? (
        <div className="emoji-picker" role="listbox" aria-label="Emoji picker">
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="emoji-button"
              onClick={() => appendEmoji(emoji)}
              disabled={disabled}
            >
              {emoji}
            </button>
          ))}
        </div>
      ) : null}

      <form className="chat-input-bar" onSubmit={handleSubmit}>
        <FileUpload
          disabled={disabled}
          isUploading={isUploading}
          onSelect={onFileSelect}
        />

        <button
          type="button"
          className="secondary-button emoji-toggle"
          onClick={() => setShowEmojiPicker((current) => !current)}
          disabled={disabled}
        >
          Emoji
        </button>

        <input
          type="text"
          placeholder="Write a message to the room..."
          value={content}
          onChange={handleChange}
          disabled={disabled}
        />

        <button type="submit" className="primary-button" disabled={isSubmitDisabled}>
          Send
        </button>
      </form>
    </div>
  );
}
