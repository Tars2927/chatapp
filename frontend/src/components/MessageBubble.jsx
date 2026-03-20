import { useState } from "react";

function formatTimestamp(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default function MessageBubble({ message, isOwnMessage, onEdit, onDelete }) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(message.content || "");
  const isImageMessage = message.file_type === "image" && Boolean(message.file_url);
  const bubbleClassName = `message-bubble ${isOwnMessage ? "own" : ""} ${isImageMessage ? "media" : ""}`;

  function handleSave() {
    const trimmed = draft.trim();
    if (!trimmed) {
      return;
    }

    const didSend = onEdit?.(message.id, trimmed);
    if (didSend !== false) {
      setIsEditing(false);
    }
  }

  return (
    <article className={`message-row ${isOwnMessage ? "own" : ""}`}>
      <div className={bubbleClassName}>
        <div className="message-meta">
          <strong>{message.sender?.username || "Unknown user"}</strong>
          <span>{formatTimestamp(message.updated_at || message.created_at)}</span>
        </div>

        {isEditing ? (
          <div className="message-edit-box">
            <input
              className="message-edit-input"
              type="text"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={4000}
            />
            <div className="message-actions editing">
              <button type="button" className="secondary-button" onClick={() => {
                setDraft(message.content || "");
                setIsEditing(false);
              }}>
                Cancel
              </button>
              <button type="button" className="primary-button" onClick={handleSave}>
                Save
              </button>
            </div>
          </div>
        ) : (
          <>
            {message.content ? <p className="message-content">{message.content}</p> : null}

            {message.file_url ? (
              message.file_type === "image" ? (
                <a href={message.file_url} target="_blank" rel="noreferrer">
                  <img className="message-image" src={message.file_url} alt="Shared upload" />
                </a>
              ) : (
                <a
                  className="message-file"
                  href={message.file_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open attachment
                </a>
              )
            ) : null}

            <div className="message-footer">
              {message.updated_at ? <span className="message-note">edited</span> : <span />}
              {isOwnMessage ? (
                <div className="message-actions">
                  {message.content ? (
                    <button
                      type="button"
                      className="message-action-button"
                      onClick={() => {
                        setDraft(message.content || "");
                        setIsEditing(true);
                      }}
                    >
                      Edit
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="message-action-button danger"
                    onClick={() => onDelete?.(message.id)}
                  >
                    Delete
                  </button>
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>
    </article>
  );
}
