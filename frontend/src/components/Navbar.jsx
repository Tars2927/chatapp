import UserAvatar from "./UserAvatar";

function WorkspaceIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5zm3 1.5v4h10V7zm0 7v3h4v-3zm6 0v3h4v-3z"
        fill="currentColor"
      />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 4.5a4.5 4.5 0 0 0-4.5 4.5v2.2c0 .8-.24 1.58-.69 2.24L5.5 15.3V17h13v-1.7l-1.31-1.86a3.9 3.9 0 0 1-.69-2.24V9A4.5 4.5 0 0 0 12 4.5m-2 14a2 2 0 0 0 4 0z"
        fill="currentColor"
      />
    </svg>
  );
}

function ThemeIcon({ theme }) {
  if (theme === "dark") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M14.5 3.2a8.7 8.7 0 1 0 6.3 14.9A9.7 9.7 0 0 1 14.5 3.2"
          fill="currentColor"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 5.2a6.8 6.8 0 1 0 0 13.6a6.8 6.8 0 0 0 0-13.6m0-3.2h.1v2.2H12zm0 17.8h.1V22H12zM4.9 4.8l1.5 1.5l-.8.8L4.1 5.6zm13.6 13.6l1.5 1.5l-.8.8l-1.5-1.5zM2 12h2.2v.1H2zm17.8 0H22v.1h-2.2zM4.1 18.4l1.5-1.5l.8.8l-1.5 1.5zm13.6-13.6l1.5-1.5l.8.8l-1.5 1.5z"
        fill="currentColor"
      />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 4.5a4 4 0 1 1 0 8a4 4 0 0 1 0-8m0 10c4.27 0 7 2.14 7 4.25V20H5v-1.25C5 16.64 7.73 14.5 12 14.5"
        fill="currentColor"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M6.4 5l5.6 5.6L17.6 5L19 6.4L13.4 12l5.6 5.6l-1.4 1.4L12 13.4L6.4 19L5 17.6l5.6-5.6L5 6.4z"
        fill="currentColor"
      />
    </svg>
  );
}

function renderBrowserAlertsLabel({
  notificationSupported,
  notificationPermission,
  browserAlertsEnabled,
}) {
  if (!notificationSupported) {
    return "Unavailable";
  }

  if (notificationPermission === "denied") {
    return "Blocked";
  }

  if (notificationPermission !== "granted") {
    return "Off";
  }

  return browserAlertsEnabled ? "On" : "Muted";
}

function renderSectionTitle(activePanel) {
  if (activePanel === "notifications") {
    return "Notifications";
  }

  if (activePanel === "profile") {
    return "Profile";
  }

  return "Workspace";
}

export default function Navbar({
  user,
  connectionLabel,
  onlineUsers,
  unreadCount,
  theme,
  notificationSupported,
  notificationPermission,
  browserAlertsEnabled,
  emailNotificationsEnabled,
  digestMinUnreadCount,
  digestPreview,
  isUpdatingEmailNotifications,
  isAvatarUpdating,
  isSidebarOpen,
  activePanel,
  onCloseSidebar,
  onSelectPanel,
  onEnableNotifications,
  onToggleBrowserAlerts,
  onEmailNotificationToggle,
  onDigestMinUnreadCountChange,
  onSaveDigestThreshold,
  onOpenAvatarPicker,
  onAvatarRemove,
  onToggleTheme,
  onLogout,
}) {
  const showNotificationAction =
    notificationSupported &&
    notificationPermission !== "granted" &&
    notificationPermission !== "denied";
  const sectionTitle = renderSectionTitle(activePanel);

  return (
    <>
      <div
        className={`chat-drawer-backdrop${isSidebarOpen ? " visible" : ""}`}
        onClick={onCloseSidebar}
        aria-hidden="true"
      />

      <section className={`chat-nav-shell${isSidebarOpen ? " open" : ""}`}>
        <nav className="chat-rail" aria-label="Workspace navigation">
          <button
            type="button"
            className={`chat-rail-button${activePanel === "workspace" && isSidebarOpen ? " active" : ""}`}
            onClick={() => onSelectPanel("workspace")}
            title="Workspace"
          >
            <WorkspaceIcon />
          </button>

          <button
            type="button"
            className={`chat-rail-button${activePanel === "notifications" && isSidebarOpen ? " active" : ""}`}
            onClick={() => onSelectPanel("notifications")}
            title="Notifications"
          >
            <BellIcon />
          </button>

          <button
            type="button"
            className="chat-rail-button"
            onClick={onToggleTheme}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            <ThemeIcon theme={theme} />
          </button>

          <button
            type="button"
            className={`chat-rail-button chat-rail-avatar${activePanel === "profile" && isSidebarOpen ? " active" : ""}`}
            onClick={() => onSelectPanel("profile")}
            title="Profile"
          >
            {user?.avatar_url ? (
              <UserAvatar
                name={user?.username || user?.email || "Authenticated user"}
                avatarUrl={user?.avatar_url}
                size="sm"
              />
            ) : (
              <UserIcon />
            )}
          </button>
        </nav>

        <aside className={`chat-drawer${isSidebarOpen ? " open" : ""}`}>
          <div className="chat-drawer-header">
            <div>
              <p className="eyebrow">Baithak</p>
              <h2>{sectionTitle}</h2>
            </div>

            <button
              type="button"
              className="chat-drawer-close"
              onClick={onCloseSidebar}
              aria-label="Close navigation"
            >
              <CloseIcon />
            </button>
          </div>

          <div className="chat-drawer-content">
            {activePanel === "workspace" ? (
              <>
                <article className="chat-drawer-card compact">
                  <span className="chat-drawer-label">Room</span>
                  <strong>Baithak Room</strong>
                  <div className="chat-drawer-mini-stats">
                    <div>
                      <span>Status</span>
                      <strong>{connectionLabel}</strong>
                    </div>
                    <div>
                      <span>Unread</span>
                      <strong>{unreadCount}</strong>
                    </div>
                    <div>
                      <span>Online</span>
                      <strong>{onlineUsers.length}</strong>
                    </div>
                  </div>
                </article>

                <article className="chat-drawer-card compact">
                  <span className="chat-drawer-label">Shortcuts</span>
                  <button
                    type="button"
                    className="chat-drawer-row-button"
                    onClick={() => onSelectPanel("notifications")}
                  >
                    <span>Notifications</span>
                    <strong>{emailNotificationsEnabled ? "On" : "Off"}</strong>
                  </button>
                  <button
                    type="button"
                    className="chat-drawer-row-button"
                    onClick={() => onSelectPanel("profile")}
                  >
                    <span>Profile</span>
                    <strong>{user?.username || "User"}</strong>
                  </button>
                </article>
              </>
            ) : null}

            {activePanel === "notifications" ? (
              <>
                <article className="chat-drawer-card compact">
                  <span className="chat-drawer-label">Browser alerts</span>
                  <div className="chat-drawer-inline">
                    <strong>
                      {renderBrowserAlertsLabel({
                        notificationSupported,
                        notificationPermission,
                        browserAlertsEnabled,
                      })}
                    </strong>

                    {notificationSupported && notificationPermission === "granted" ? (
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={onToggleBrowserAlerts}
                      >
                        {browserAlertsEnabled ? "Mute" : "Unmute"}
                      </button>
                    ) : null}

                    {showNotificationAction ? (
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={onEnableNotifications}
                      >
                        Enable
                      </button>
                    ) : null}
                  </div>
                </article>

                <article className="chat-drawer-card compact">
                  <span className="chat-drawer-label">Email digest</span>
                  <div className="chat-drawer-inline">
                    <strong>{emailNotificationsEnabled ? "On" : "Off"}</strong>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={onEmailNotificationToggle}
                      disabled={isUpdatingEmailNotifications}
                    >
                      {isUpdatingEmailNotifications
                        ? "Saving..."
                        : emailNotificationsEnabled
                          ? "Turn off"
                          : "Turn on"}
                    </button>
                  </div>

                  <label className="notification-threshold-field compact">
                    <span>Minimum unread</span>
                    <div className="chat-drawer-threshold-row">
                      <input
                        type="number"
                        min="1"
                        max="999"
                        value={digestMinUnreadCount}
                        onChange={(event) =>
                          onDigestMinUnreadCountChange(
                            Math.max(1, Number(event.target.value || 1)),
                          )
                        }
                      />

                      <button
                        type="button"
                        className="primary-button"
                        onClick={onSaveDigestThreshold}
                        disabled={isUpdatingEmailNotifications}
                      >
                        Save
                      </button>
                    </div>
                  </label>
                </article>

                <article className="chat-drawer-card compact accent">
                  <span className="chat-drawer-label">Digest preview</span>
                  <strong>
                    {digestPreview?.unread_count || 0} unread
                  </strong>
                  <p>
                    Threshold {digestPreview?.digest_min_unread_count || digestMinUnreadCount}
                  </p>
                  <p>
                    {digestPreview?.should_send_digest ? "Eligible now" : "Not eligible yet"}
                  </p>
                </article>
              </>
            ) : null}

            {activePanel === "profile" ? (
              <>
                <article className="chat-drawer-card profile">
                  <div className="chat-drawer-profile-head">
                    <UserAvatar
                      name={user?.username || user?.email || "Authenticated user"}
                      avatarUrl={user?.avatar_url}
                      size="xl"
                    />
                    <div>
                      <span className="chat-drawer-label">Account</span>
                      <strong>{user?.username || "Authenticated user"}</strong>
                      <p>{user?.email || "No email available"}</p>
                    </div>
                  </div>

                  <div className="chat-drawer-inline">
                    <button
                      type="button"
                      className="primary-button"
                      onClick={onOpenAvatarPicker}
                      disabled={isAvatarUpdating}
                    >
                      {isAvatarUpdating
                        ? "Updating..."
                        : user?.avatar_url
                          ? "Change avatar"
                          : "Upload avatar"}
                    </button>

                    <button
                      type="button"
                      className="secondary-button"
                      onClick={onAvatarRemove}
                      disabled={isAvatarUpdating || !user?.avatar_url}
                    >
                      Remove
                    </button>
                  </div>
                </article>
              </>
            ) : null}
          </div>

          <div className="chat-drawer-footer">
            {user?.is_admin ? (
              <a className="secondary-button chat-drawer-footer-button" href="/admin">
                Admin
              </a>
            ) : null}

            <button
              type="button"
              className="secondary-button chat-drawer-footer-button danger"
              onClick={onLogout}
            >
              Logout
            </button>
          </div>
        </aside>
      </section>
    </>
  );
}
