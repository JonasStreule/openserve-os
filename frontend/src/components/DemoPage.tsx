import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

interface DemoScenario {
  id: string;
  emoji: string;
  title: string;
  subtitle: string;
  description: string;
  personas: DemoPersona[];
}

interface DemoPersona {
  label: string;
  username: string;
  pin: string;
  role: string;
  hint: string;
}

const SCENARIOS: DemoScenario[] = [
  {
    id: 'guest',
    emoji: '🪑',
    title: 'Als Gast bestellen',
    subtitle: 'Tisch T-1 · Keine Anmeldung nötig',
    description: 'Scanne den QR-Code am Tisch, wähle Speisen aus der Karte und gib deine Bestellung auf. Verfolge den Status live.',
    personas: [
      {
        label: 'Tisch T-1 (2 Personen)',
        username: '',
        pin: '',
        role: 'guest',
        hint: 'Einfache Bestellung am kleinen Tisch',
      },
      {
        label: 'Tisch T-4 (6 Personen)',
        username: '',
        pin: '',
        role: 'guest-t4',
        hint: 'Grosse Bestellung mit vielen Positionen',
      },
    ],
  },
  {
    id: 'service',
    emoji: '🍽️',
    title: 'Als Servicemitarbeiter',
    subtitle: 'Bestellungen · Zahlungen · Kasse',
    description: 'Verwalte laufende Bestellungen, nehme Zahlungen entgegen (Karte, Bargeld, Twint) und öffne/schliesse die Tageskasse.',
    personas: [
      {
        label: 'Anna — Servicemitarbeiterin',
        username: 'Anna',
        pin: '1234',
        role: 'service',
        hint: 'Einfacher Einstieg: Bestellungen & Zahlungen',
      },
      {
        label: 'Marco — Servicemitarbeiter',
        username: 'Marco',
        pin: '1234',
        role: 'service',
        hint: 'Gleiche Ansicht, anderes Login',
      },
    ],
  },
  {
    id: 'kitchen',
    emoji: '👨‍🍳',
    title: 'Als Küchenmitarbeiter',
    subtitle: 'Bestellqueue · Live-Updates',
    description: 'Sieh alle eingehenden Bestellungen mit den bestellten Positionen. Setze Status auf "In Zubereitung" und "Bereit zum Servieren".',
    personas: [
      {
        label: 'Luca — Küchenmitarbeiter',
        username: 'Luca',
        pin: '1234',
        role: 'kitchen',
        hint: 'Bestellungen annehmen und bearbeiten',
      },
    ],
  },
  {
    id: 'admin',
    emoji: '📊',
    title: 'Als Restaurantleiter',
    subtitle: 'Vollzugang · Alle Funktionen',
    description: 'Vollständige Kontrolle: Tagesumsätze, Audit-Log, Mitarbeiter-Leaderboard. Verwalte Speisekarte, Tische und Personal.',
    personas: [
      {
        label: 'Admin — Restaurantleiter',
        username: 'Admin',
        pin: '0000',
        role: 'admin',
        hint: 'Alle Tabs und Verwaltungsfunktionen',
      },
    ],
  },
];

const QR_TOKENS: Record<string, string> = {
  'guest': 'table-T1-a1b2c3d4',
  'guest-t4': 'table-T4-m3n4o5p6',
};

export function DemoPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handlePersona = async (persona: DemoPersona) => {
    setError('');

    // Guest: no login, just navigate with QR token
    if (persona.role === 'guest' || persona.role === 'guest-t4') {
      const token = QR_TOKENS[persona.role];
      navigate(`/guest?token=${token}`);
      return;
    }

    setLoading(`${persona.username}-${persona.role}`);
    try {
      const data = await api.login(persona.username, persona.pin);
      if (data.error) {
        setError(`Login fehlgeschlagen: ${data.error}`);
        setLoading(null);
        return;
      }
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      switch (data.user.role) {
        case 'admin': navigate('/admin'); break;
        case 'kitchen': navigate('/kitchen'); break;
        default: navigate('/service'); break;
      }
    } catch {
      setError('Verbindung zum Server fehlgeschlagen. Bitte starte den Backend-Server.');
      setLoading(null);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-gray-100)', padding: '24px 16px' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: '700', margin: '0 0 6px 0' }}>OpenServe OS</h1>
          <p style={{ color: 'var(--color-secondary)', margin: '0 0 4px 0' }}>Demo-Umgebung · Sandkasten</p>
          <p style={{ color: 'var(--color-secondary)', fontSize: '13px', margin: 0 }}>
            Klicke auf eine Rolle und erkunde das System — keine echten Daten.
          </p>
        </div>

        {error && (
          <div style={{
            background: 'var(--color-error)', color: 'white', padding: '12px 16px',
            borderRadius: 'var(--radius-md)', marginBottom: '20px', fontSize: '14px',
          }}>
            {error}
          </div>
        )}

        {/* Scenarios */}
        <div style={{ display: 'grid', gap: '16px' }}>
          {SCENARIOS.map(scenario => (
            <div key={scenario.id} className="card" style={{ padding: '20px' }}>
              {/* Scenario header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '16px' }}>
                <span style={{ fontSize: '32px', lineHeight: 1 }}>{scenario.emoji}</span>
                <div style={{ flex: 1 }}>
                  <h2 style={{ margin: '0 0 2px 0', fontSize: '18px' }}>{scenario.title}</h2>
                  <p style={{ margin: '0 0 6px 0', fontSize: '12px', color: 'var(--color-info)', fontWeight: '600' }}>
                    {scenario.subtitle}
                  </p>
                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-secondary)', lineHeight: '1.5' }}>
                    {scenario.description}
                  </p>
                </div>
              </div>

              {/* Persona buttons */}
              <div style={{ display: 'grid', gap: '8px' }}>
                {scenario.personas.map(persona => {
                  const key = `${persona.username}-${persona.role}`;
                  const isLoading = loading === key;
                  const isGuest = persona.role === 'guest' || persona.role === 'guest-t4';
                  return (
                    <button
                      key={key}
                      onClick={() => handlePersona(persona)}
                      disabled={!!loading}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 16px',
                        background: 'var(--color-gray-100)',
                        border: '1px solid var(--color-gray-200)',
                        borderRadius: 'var(--radius-md)',
                        cursor: loading ? 'default' : 'pointer',
                        opacity: loading && !isLoading ? 0.5 : 1,
                        fontFamily: 'var(--font-system)',
                        textAlign: 'left',
                        width: '100%',
                        transition: 'background 0.1s',
                      }}
                    >
                      <div>
                        <p style={{ margin: '0 0 2px 0', fontSize: '14px', fontWeight: '600', color: 'var(--color-primary)' }}>
                          {isLoading ? 'Einloggen...' : persona.label}
                        </p>
                        <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-secondary)' }}>
                          {persona.hint}
                        </p>
                      </div>
                      {!isGuest && (
                        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '12px' }}>
                          <p style={{ margin: '0 0 1px 0', fontSize: '11px', color: 'var(--color-secondary)' }}>Login</p>
                          <p style={{ margin: 0, fontSize: '12px', fontFamily: 'monospace', color: 'var(--color-primary)' }}>
                            {persona.username} · PIN {persona.pin}
                          </p>
                        </div>
                      )}
                      {isGuest && (
                        <span style={{ fontSize: '12px', color: 'var(--color-info)', flexShrink: 0, marginLeft: '12px' }}>
                          Direkt →
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: '28px' }}>
          <a
            href="/login"
            style={{ fontSize: '13px', color: 'var(--color-secondary)', textDecoration: 'none' }}
          >
            ← Zurück zum Login
          </a>
        </div>
      </div>
    </div>
  );
}
