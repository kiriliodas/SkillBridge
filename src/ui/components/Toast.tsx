/**
 * Accessible toast stack. Toasts are polite by default; errors are assertive.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { IconAlert, IconCheckCircle, IconInfo, IconX } from './Icons';

export type ToastTone = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
  detail?: string;
}

interface ToastContextValue {
  push: (tone: ToastTone, message: string, detail?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const push = useCallback(
    (tone: ToastTone, message: string, detail?: string) => {
      const toast: Toast = { id: nextId++, tone, message, ...(detail ? { detail } : {}) };
      setToasts((current) => [...current.slice(-3), toast]);
      const timer = setTimeout(() => dismiss(toast.id), tone === 'error' ? 9000 : 5000);
      timers.current.set(toast.id, timer);
    },
    [dismiss],
  );

  useEffect(() => {
    const timersMap = timers.current;
    return () => {
      for (const timer of timersMap.values()) clearTimeout(timer);
      timersMap.clear();
    };
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" role="region" aria-label="Notifications">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast toast--${toast.tone}`}
            role={toast.tone === 'error' ? 'alert' : 'status'}
          >
            <span className="toast__icon">
              {toast.tone === 'success' && <IconCheckCircle size={16} />}
              {toast.tone === 'error' && <IconAlert size={16} />}
              {toast.tone === 'info' && <IconInfo size={16} />}
            </span>
            <div className="toast__body">
              <p className="toast__message">{toast.message}</p>
              {toast.detail && <p className="toast__detail">{toast.detail}</p>}
            </div>
            <button className="toast__close" onClick={() => dismiss(toast.id)} aria-label="Dismiss notification">
              <IconX size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
