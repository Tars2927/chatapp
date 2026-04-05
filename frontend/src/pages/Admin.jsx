import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import api from "../api/axios";

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

export default function Admin() {
  const navigate = useNavigate();
  const user = readStoredUser();
  const [pendingUsers, setPendingUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadPendingUsers() {
      try {
        const response = await api.get("/admin/pending-users");
        setPendingUsers(response.data);
      } catch (requestError) {
        setError(
          requestError.response?.data?.detail ||
            "Could not load pending users.",
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadPendingUsers();
  }, []);

  async function handleApprove(userId) {
    try {
      await api.post(`/admin/users/${userId}/approve`);
      setPendingUsers((current) => current.filter((entry) => entry.id !== userId));
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail ||
          "Could not approve that user.",
      );
    }
  }

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login", { replace: true });
  }

  return (
    <main className="chat-shell admin-shell">
      <header className="chat-header">
        <div>
          <div className="brand-lockup">
            <img className="brand-logo" src="/baithak-logo.svg" alt="Baithak logo" />
            <div>
              <p className="eyebrow">Baithak Admin</p>
              <h1>Approval Queue</h1>
            </div>
          </div>
          <p className="chat-subtitle">
            Signed in as {user?.username || "admin"}
          </p>
        </div>

        <div className="chat-header-actions">
          <Link className="secondary-button" to="/chat">
            Back to Chat
          </Link>
          <button type="button" className="secondary-button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <section className="chat-panel admin-panel">
        {error ? <p className="form-error">{error}</p> : null}

        {isLoading ? (
          <div className="chat-status-card">
            <p className="chat-copy">Loading pending users...</p>
          </div>
        ) : pendingUsers.length ? (
          <div className="admin-list">
            {pendingUsers.map((pendingUser) => (
              <article key={pendingUser.id} className="admin-user-card">
                <div>
                  <strong>{pendingUser.username}</strong>
                  <p>{pendingUser.email}</p>
                </div>

                <button
                  type="button"
                  className="primary-button"
                  onClick={() => handleApprove(pendingUser.id)}
                >
                  Approve
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="chat-status-card">
            <p className="chat-copy">No verified pending users right now.</p>
          </div>
        )}
      </section>
    </main>
  );
}
