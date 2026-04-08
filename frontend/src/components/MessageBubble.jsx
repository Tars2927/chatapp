import { useState } from "react";

import UserAvatar from "./UserAvatar";

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

function formatCategoryLabel(label) {
  return label.replace(/_/g, " ");
}

function readModeration(message) {
  const moderation =
    message?.toxic_labels && typeof message.toxic_labels === "object"
      ? message.toxic_labels
      : null;
  const labels =
    moderation?.labels && typeof moderation.labels === "object" ? moderation.labels : {};
  const fallbackFlaggedCategories = Object.entries(labels)
    .filter(([, score]) => Number(score) >= 0.5)
    .map(([label]) => label);

  return {
    flaggedCategories:
      Array.isArray(moderation?.flagged_categories) && moderation.flagged_categories.length
        ? moderation.flagged_categories
        : fallbackFlaggedCategories,
    topWords: Array.isArray(moderation?.explanation?.top_words)
      ? moderation.explanation.top_words
      : [],
  };
}

export default function MessageBubble({ message, isOwnMessage, onEdit, onDelete }) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(message.content || "");
  const isImageMessage = message.file_type === "image" && Boolean(message.file_url);
  const moderation = readModeration(message);
  const isFlagged = Boolean(message.is_toxic || moderation.flaggedCategories.length);
  const confidencePercent =
    typeof message.toxicity_confidence === "number"
      ? Math.round(message.toxicity_confidence * 100)
      : null;
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
      {!isOwnMessage ? (
        <div className="message-avatar">
          <UserAvatar
            name={message.sender?.username || "Unknown user"}
            avatarUrl={message.sender?.avatar_url}
            size="sm"
          />
        </div>
      ) : null}

      <div className={bubbleClassName}>
        <div className="message-meta">
          <div className="message-meta-primary">
            <strong>{message.sender?.username || "Unknown user"}</strong>
            {isFlagged ? <span className="message-toxicity-badge">⚠ Flagged</span> : null}
          </div>
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
            {isFlagged && moderation.flaggedCategories.length ? (
              <p className="message-toxicity-summary">
                {moderation.flaggedCategories.map(formatCategoryLabel).join(", ")}
                {confidencePercent !== null ? ` · ${confidencePercent}% confidence` : ""}
              </p>
            ) : null}

            {isFlagged && moderation.topWords.length ? (
              <p className="message-toxicity-explainer">
                Signals: {moderation.topWords.map((entry) => entry.word).join(", ")}
              </p>
            ) : null}

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

      {isOwnMessage ? (
        <div className="message-avatar">
          <UserAvatar
            name={message.sender?.username || "Unknown user"}
            avatarUrl={message.sender?.avatar_url}
            size="sm"
          />
        </div>
      ) : null}
    </article>
  );
}
