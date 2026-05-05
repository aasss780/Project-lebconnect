import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

import "./ToastViewport.css";

const ToastContext = createContext(null);

/** @typedef {"ok" | "err" | "info"} ToastKind */

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);

  const push = useCallback((message, kind = "info") => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    setItems((prev) => [...prev, { id, message, kind }]);
    const ms = kind === "err" ? 5200 : 4200;
    setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, ms);
  }, []);

  const value = useMemo(
    () => ({
      toast: push,
      success: (m) => push(m, "ok"),
      error: (m) => push(m, "err"),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="lc-toast-host" aria-live="polite">
        {items.map((t) => (
          <div
            key={t.id}
            className={`lc-toast lc-toast--${t.kind}`}
            role="status"
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** @returns {{ toast: (msg: string, kind?: ToastKind) => void; success: (m:string)=>void; error: (m:string)=>void }} */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      toast: () => {},
      success: () => {},
      error: () => {},
    };
  }
  return ctx;
}
