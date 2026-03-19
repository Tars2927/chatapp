export default function Navbar({ user, connectionLabel, onLogout }) {
  return (
    <header className="chat-header">
      <div>
        <p className="eyebrow">Live Chat</p>
        <h1>Friend Group Room</h1>
        <p className="chat-subtitle">
          Signed in as {user?.username || "user"} · {connectionLabel}
        </p>
      </div>

      <div className="chat-header-actions">
        <div className="chat-user-card compact">
          <span className="status-dot" />
          <div>
            <strong>{user?.username || "Authenticated user"}</strong>
            <p>{user?.email || "No email available"}</p>
          </div>
        </div>

        <button type="button" className="secondary-button" onClick={onLogout}>
          Logout
        </button>
      </div>
    </header>
  );
}
