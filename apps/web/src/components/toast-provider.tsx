"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

export type ToastTone = "success" | "error" | "info";

export type ToastInput = {
  message: string;
  tone?: ToastTone;
  durationMs?: number;
};

type ToastItem = {
  id: string;
  message: string;
  tone: ToastTone;
};

type ToastContextValue = {
  pushToast: (input: ToastInput) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

function createToastId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function ToastProvider({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback(
    ({ message, tone = "info", durationMs = 4500 }: ToastInput) => {
      const normalizedMessage = message.trim();
      if (normalizedMessage.length === 0) {
        return;
      }

      const id = createToastId();
      setToasts((current) =>
        [...current, { id, message: normalizedMessage, tone }].slice(-5),
      );

      if (durationMs > 0 && typeof window !== "undefined") {
        window.setTimeout(() => dismissToast(id), durationMs);
      }
    },
    [dismissToast],
  );

  const value = useMemo<ToastContextValue>(() => ({ pushToast }), [pushToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <aside className="toast-viewport" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <article
            key={toast.id}
            className={`toast toast--${toast.tone}`}
            role="status"
          >
            <p>{toast.message}</p>
            <button
              type="button"
              aria-label="Fechar notificação"
              onClick={() => dismissToast(toast.id)}
            >
              Fechar
            </button>
          </article>
        ))}
      </aside>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider.");
  }

  return context;
}
