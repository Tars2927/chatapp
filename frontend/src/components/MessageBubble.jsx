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

export default function MessageBubble({ message, isOwnMessage }) {
  return (
    <article className={`message-row ${isOwnMessage ? "own" : ""}`}>
      <div className={`message-bubble ${isOwnMessage ? "own" : ""}`}>
        <div className="message-meta">
          <strong>{message.sender?.username || "Unknown user"}</strong>
          <span>{formatTimestamp(message.created_at)}</span>
        </div>

        {message.content ? <p className="message-content">{message.content}</p> : null}

        {message.file_url ? (
          <a
            className="message-file"
            href={message.file_url}
            target="_blank"
            rel="noreferrer"
          >
            {message.file_type === "image" ? "Open image" : "Open attachment"}
          </a>
        ) : null}
      </div>
    </article>
  );
}
