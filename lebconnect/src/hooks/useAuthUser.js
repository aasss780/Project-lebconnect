import { useEffect, useState } from "react";
import { getUser } from "../utils/auth";

/**
 * Mirrors localStorage `user`; re-renders when setAuth()/logout dispatch
 * `lebconnect-auth-changed` (same tab).
 */
export function useAuthUser() {
  const [user, setUser] = useState(() => getUser());

  useEffect(() => {
    const sync = () => setUser(getUser());
    window.addEventListener("lebconnect-auth-changed", sync);
    return () => window.removeEventListener("lebconnect-auth-changed", sync);
  }, []);

  return user;
}
