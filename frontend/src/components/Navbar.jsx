export default function Navbar({ user, connectionLabel, onlineUsers, onLogout }) {
  return (
    <header className="chat-header">
      <div>
        <div className="brand-lockup">
          <img className="brand-logo" src="/baithak-logo.svg" alt="Baithak logo" />
          <div>
            <p className="eyebrow">Baithak</p>
            <h1>Baithak Room</h1>
          </div>
        </div>
        <p className="chat-subtitle">
          Signed in as {user?.username || "user"} · {connectionLabel}
        </p>
        <p className="chat-online-summary">
          {onlineUsers.length
            ? `${onlineUsers.length} online: ${onlineUsers.map((entry) => entry.username).join(", ")}`
            : "No one else is online yet."}
        </p>
      </div>

      <div className="chat-header-actions">
        {user?.is_admin ? (
          <a className="secondary-button" href="/admin">
            Admin
          </a>
        ) : null}

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
