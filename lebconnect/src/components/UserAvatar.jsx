import { initialsFromName } from "../utils/format";
import { avatarUrlFromUser, displayNameFromUser } from "../utils/avatar";

export default function UserAvatar({
  user,
  name,
  src,
  size = 40,
  className = "",
}) {
  const label = name ?? displayNameFromUser(user);
  const url = src ?? avatarUrlFromUser(user);
  const styleBase = {
    width: size,
    height: size,
    borderRadius: "50%",
    flexShrink: 0,
    fontSize: Math.max(11, Math.round(size * 0.34)),
    fontWeight: 700,
  };

  if (url) {
    return (
      <img
        alt=""
        className={`lc-user-avatar lc-user-avatar--img ${className}`}
        src={url}
        style={{ ...styleBase, objectFit: "cover" }}
      />
    );
  }

  return (
    <span
      className={`lc-user-avatar lc-user-avatar--initials ${className}`}
      style={{
        ...styleBase,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
        color: "#fff",
      }}
      aria-hidden
    >
      {initialsFromName(label).slice(0, 2)}
    </span>
  );
}
