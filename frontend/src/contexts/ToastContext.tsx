import React, { createContext, useContext, useState, useCallback } from 'react';
import { Snackbar, Alert, AlertColor } from '@mui/material';

interface Toast {
  id: number;
  message: string;
  severity: AlertColor;
  duration?: number;
}

interface ToastContextValue {
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let _nextId = 1;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, severity: AlertColor, duration = 4000) => {
    const id = _nextId++;
    setToasts((prev) => [...prev, { id, message, severity, duration }]);
  }, []);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value: ToastContextValue = {
    success: (msg, d) => push(msg, 'success', d),
    error: (msg, d) => push(msg, 'error', d ?? 6000),
    warning: (msg, d) => push(msg, 'warning', d),
    info: (msg, d) => push(msg, 'info', d),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toasts.map((toast, idx) => (
        <Snackbar
          key={toast.id}
          open
          autoHideDuration={toast.duration}
          onClose={() => remove(toast.id)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          sx={{ bottom: { xs: 16 + idx * 64, sm: 24 + idx * 64 } }}
        >
          <Alert
            onClose={() => remove(toast.id)}
            severity={toast.severity}
            variant="filled"
            elevation={6}
            sx={{ minWidth: 280, maxWidth: 420 }}
          >
            {toast.message}
          </Alert>
        </Snackbar>
      ))}
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast doit être utilisé dans un <ToastProvider>');
  return ctx;
};
