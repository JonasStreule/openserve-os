import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const data = await api.login(username, pin);
      if (data.error) {
        setError(data.error);
        setLoading(false);
        return;
      }
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      // Redirect based on role
      switch (data.user.role) {
        case 'admin': navigate('/admin'); break;
        case 'kitchen': navigate('/kitchen'); break;
        default: navigate('/service'); break;
      }
    } catch {
      setError('Login failed');
    }
    setLoading(false);
  };

  const handlePinButton = (digit: string) => {
    if (pin.length < 6) setPin(prev => prev + digit);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-gray-100)' }}>
      <div style={{ width: '320px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '4px' }}>OpenServe OS</h1>
        <p style={{ color: 'var(--color-secondary)', marginBottom: '32px' }}>Staff Login</p>

        {error && (
          <div style={{ background: 'var(--color-error)', color: 'white', padding: '10px', borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: '14px' }}>
            {error}
          </div>
        )}

        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={e => setUsername(e.target.value)}
          style={{ width: '100%', marginBottom: '12px', height: '48px', fontSize: '16px' }}
        />

        {/* PIN display */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '20px' }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{
              width: '48px', height: '48px', borderRadius: '50%',
              border: '2px solid var(--color-gray-200)',
              background: i < pin.length ? 'var(--color-black)' : 'transparent',
            }} />
          ))}
        </div>

        {/* PIN pad */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '16px' }}>
          {['1','2','3','4','5','6','7','8','9','','0',''].map((d, i) => (
            d ? (
              <button key={i} className="button secondary" onClick={() => handlePinButton(d)}
                style={{ height: '56px', fontSize: '20px', fontWeight: '600' }}>
                {d}
              </button>
            ) : i === 11 ? (
              <button key={i} className="button secondary" onClick={() => setPin(prev => prev.slice(0, -1))}
                style={{ height: '56px', fontSize: '16px' }}>
                Del
              </button>
            ) : <div key={i} />
          ))}
        </div>

        <button className="button primary" onClick={handleLogin} disabled={loading || !username || pin.length < 4}
          style={{ width: '100%', height: '52px', fontSize: '16px', opacity: (!username || pin.length < 4) ? 0.5 : 1 }}>
          {loading ? 'Logging in...' : 'Login'}
        </button>

        <a href="/guest" style={{ display: 'block', marginTop: '24px', color: 'var(--color-info)', fontSize: '14px', textDecoration: 'none' }}>
          Guest? Order here
        </a>
      </div>
    </div>
  );
}
