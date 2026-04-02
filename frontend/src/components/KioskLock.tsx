import { useState, useEffect } from 'react';
import { api } from '../services/api';

interface Props {
  stationName: string;
  children: React.ReactNode;
}

export function KioskLock({ stationName, children }: Props) {
  const [locked, setLocked] = useState(!localStorage.getItem('token'));
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const lock = () => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setPin('');
      setError('');
      setLocked(true);
    };
    window.addEventListener('kiosk:locked', lock);
    return () => window.removeEventListener('kiosk:locked', lock);
  }, []);

  const handleUnlock = async () => {
    if (!username || pin.length < 4) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.login(username, pin);
      if (data.error) {
        setError('Ungültige Zugangsdaten');
        setPin('');
        setLoading(false);
        return;
      }
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setLocked(false);
      setPin('');
      setUsername('');
    } catch {
      setError('Verbindungsfehler');
    }
    setLoading(false);
  };

  const handlePin = (d: string) => {
    if (pin.length < 6) setPin(p => p + d);
  };

  if (!locked) return <>{children}</>;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.92)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ width: '300px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '12px' }}>🔒</div>
        <h2 style={{ color: 'white', margin: '0 0 4px 0', fontSize: '20px' }}>{stationName}</h2>
        <p style={{ color: 'rgba(255,255,255,0.5)', margin: '0 0 28px 0', fontSize: '14px' }}>
          Station gesperrt — bitte entsperren
        </p>

        {error && (
          <div style={{ background: 'var(--color-error)', color: 'white', padding: '8px', borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: '13px' }}>
            {error}
          </div>
        )}

        <input
          type="text"
          placeholder="Benutzername"
          value={username}
          onChange={e => setUsername(e.target.value)}
          style={{ width: '100%', marginBottom: '12px', height: '44px', fontSize: '15px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: 'var(--radius-md)' }}
        />

        {/* PIN dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '16px' }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{
              width: '44px', height: '44px', borderRadius: '50%',
              border: '2px solid rgba(255,255,255,0.3)',
              background: i < pin.length ? 'white' : 'transparent',
            }} />
          ))}
        </div>

        {/* PIN pad */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '16px' }}>
          {['1','2','3','4','5','6','7','8','9','','0',''].map((d, i) => (
            d ? (
              <button key={i} onClick={() => handlePin(d)}
                style={{ height: '52px', fontSize: '20px', fontWeight: '600', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 'var(--radius-md)', color: 'white', cursor: 'pointer', fontFamily: 'var(--font-system)' }}>
                {d}
              </button>
            ) : i === 11 ? (
              <button key={i} onClick={() => setPin(p => p.slice(0,-1))}
                style={{ height: '52px', fontSize: '14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 'var(--radius-md)', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontFamily: 'var(--font-system)' }}>
                Del
              </button>
            ) : <div key={i} />
          ))}
        </div>

        <button
          onClick={handleUnlock}
          disabled={loading || !username || pin.length < 4}
          style={{
            width: '100%', height: '48px', fontSize: '15px', fontWeight: '600',
            background: (!username || pin.length < 4) ? 'rgba(255,255,255,0.15)' : 'white',
            color: (!username || pin.length < 4) ? 'rgba(255,255,255,0.4)' : 'black',
            border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer',
            fontFamily: 'var(--font-system)',
          }}
        >
          {loading ? 'Entsperren...' : 'Entsperren'}
        </button>
      </div>
    </div>
  );
}
