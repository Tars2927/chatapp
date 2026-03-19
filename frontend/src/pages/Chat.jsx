import { useNavigate } from "react-router-dom";

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

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login", { replace: true });
  }

  return (
    <main className="chat-shell">
      <header className="chat-header">
        <div>
          <p className="eyebrow">Protected Route</p>
          <h1>Chat Placeholder</h1>
        </div>

        <button type="button" className="secondary-button" onClick={handleLogout}>
          Logout
        </button>
      </header>

      <section className="chat-panel">
        <p className="chat-copy">
          Day 2 stops here: auth is wired up, routing is protected, and this page
          is the handoff point for real-time chat work on Day 3.
        </p>

        <div className="chat-user-card">
          <span className="status-dot" />
          <div>
            <strong>{user?.username || "Authenticated user"}</strong>
            <p>{user?.email || "User metadata will show here after login."}</p>
          </div>
        </div>
      </section>
    </main>
  );
}
