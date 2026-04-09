interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel?: string;
  confirmColor?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({ title, message, confirmLabel = 'Bestätigen', confirmColor = 'var(--color-error)', onConfirm, onCancel }: ConfirmModalProps) {
  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.5)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', zIndex: 2000,
      }}
      onClick={onCancel}
    >
      <div
        className="card"
        style={{ width: '360px', padding: '24px', textAlign: 'center' }}
        onClick={e => e.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 8px 0', fontSize: '18px' }}>{title}</h2>
        <p style={{ margin: '0 0 24px 0', color: 'var(--color-secondary)', fontSize: '14px', lineHeight: '1.5' }}>
          {message}
        </p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="button secondary"
            onClick={onCancel}
            style={{ flex: 1, height: '44px', fontSize: '15px' }}
          >
            Abbrechen
          </button>
          <button
            className="button primary"
            onClick={onConfirm}
            style={{ flex: 1, height: '44px', fontSize: '15px', background: confirmColor }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
