import { useState, useEffect, useCallback } from 'react';

interface ToastMessage {
  id: number;
  text: string;
  type: 'success' | 'error' | 'info';
}

let toastId = 0;
const listeners: Array<(msg: ToastMessage) => void> = [];

/** Show a toast notification from anywhere */
export function showToast(text: string, type: 'success' | 'error' | 'info' = 'success') {
  const msg: ToastMessage = { id: ++toastId, text, type };
  listeners.forEach(fn => fn(msg));
}

const COLORS = {
  success: { bg: '#10b981', icon: '✓' },
  error: { bg: '#ef4444', icon: '!' },
  info: { bg: '#3b82f6', icon: 'i' },
};

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((msg: ToastMessage) => {
    setToasts(prev => [...prev, msg]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== msg.id));
    }, 3000);
  }, []);

  useEffect(() => {
    listeners.push(addToast);
    return () => {
      const idx = listeners.indexOf(addToast);
      if (idx >= 0) listeners.splice(idx, 1);
    };
  }, [addToast]);

  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed', top: '16px', right: '16px', zIndex: 9999,
      display: 'flex', flexDirection: 'column', gap: '8px',
      pointerEvents: 'none',
    }}>
      {toasts.map(toast => (
        <div key={toast.id} style={{
          background: COLORS[toast.type].bg,
          color: 'white',
          padding: '12px 20px',
          borderRadius: '10px',
          fontSize: '14px',
          fontWeight: '600',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          animation: 'slideIn 0.2s ease-out',
          pointerEvents: 'auto',
        }}>
          <span style={{
            width: '22px', height: '22px', borderRadius: '50%',
            background: 'rgba(255,255,255,0.25)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: '12px', fontWeight: '700',
          }}>
            {COLORS[toast.type].icon}
          </span>
          {toast.text}
        </div>
      ))}
    </div>
  );
}
