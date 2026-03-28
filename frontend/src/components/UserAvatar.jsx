function readInitials(name) {
  const words = (name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!words.length) {
    return "B";
  }

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return `${words[0][0] || ""}${words[1][0] || ""}`.toUpperCase();
}

export default function UserAvatar({ name, avatarUrl, size = "md" }) {
  const initials = readInitials(name);

  return (
    <div
      className={`user-avatar user-avatar-${size}${avatarUrl ? " has-image" : ""}`}
      aria-hidden="true"
    >
      {avatarUrl ? <img src={avatarUrl} alt="" /> : <span>{initials}</span>}
    </div>
  );
}
