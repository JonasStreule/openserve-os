import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

interface Persona {
  label: string;
  tag: string;
  tagColor: string;
  username: string;
  pin: string;
  role: string;
  description: string;
  qrToken?: string;
}

interface Restaurant {
  emoji: string;
  name: string;
  badge: string;
  badgeColor: string;
  headline: string;
  personas: Persona[];
}

const RESTAURANTS: Restaurant[] = [
  {
    emoji: '🚚',
    name: 'Street Bites',
    badge: 'Einfach',
    badgeColor: 'var(--color-success)',
    headline: 'Foodtruck · Theke & Aussensitzplätze · Keine Küche',
    personas: [
      {
        label: 'Kai — Servicemitarbeiter',
        tag: 'Service',
        tagColor: 'var(--color-info)',
        username: 'Kai',
        pin: '0101',
        role: 'service',
        description: 'Nimmt Bestellungen auf, kassiert direkt an der Theke. Keine Küchen-Übergabe.',
      },
      {
        label: 'Sam — Inhaber & Admin',
        tag: 'Admin',
        tagColor: 'var(--color-error)',
        username: 'Sam',
        pin: '0101',
        role: 'admin',
        description: 'Überblick über Tagesumsatz, verwaltet die kurze Speisekarte und die Counter-Plätze.',
      },
      {
        label: 'Buffet-Station (Tischplan)',
        tag: 'Station',
        tagColor: '#7c3aed',
        username: 'Buffet',
        pin: '6666',
        role: 'service',
        description: 'Grafische Tischübersicht — Bestellungen aufnehmen und Tischstatus sehen.',
      },
      {
        label: 'Gast am Outdoor-1',
        tag: 'Gast',
        tagColor: 'var(--color-secondary)',
        username: '',
        pin: '',
        role: 'guest',
        description: 'Bestellt vom Handy direkt am Tisch — kurze Karte, schnell bestellt.',
        qrToken: 'table-O1-ft003ccc',
      },
    ],
  },
  {
    emoji: '🍝',
    name: 'Ristorante Mezzaluna',
    badge: 'Vollständig',
    badgeColor: 'var(--color-warning)',
    headline: 'Restaurant · Vollbetrieb · Küche + Service + Admin',
    personas: [
      {
        label: 'Admin — Restaurantleiter',
        tag: 'Admin',
        tagColor: 'var(--color-error)',
        username: 'Admin',
        pin: '0000',
        role: 'admin',
        description: 'Vollzugang: Tagesumsätze, Audit-Log, Leaderboard, Mitarbeiter & Speisekarte verwalten.',
      },
      {
        label: 'Anna — Servicemitarbeiterin',
        tag: 'Service',
        tagColor: 'var(--color-info)',
        username: 'Anna',
        pin: '1234',
        role: 'service',
        description: 'Bestellungen annehmen, Zahlungen (Karte / Bargeld / Twint), Tageskasse öffnen & schliessen.',
      },
      {
        label: 'Marco — Servicemitarbeiter',
        tag: 'Service',
        tagColor: 'var(--color-info)',
        username: 'Marco',
        pin: '1234',
        role: 'service',
        description: 'Gleiche Funktionen wie Anna — zwei Servicekräfte gleichzeitig im Einsatz.',
      },
      {
        label: 'Luca — Küchenmitarbeiter',
        tag: 'Küche',
        tagColor: '#8b5cf6',
        username: 'Luca',
        pin: '1234',
        role: 'kitchen',
        description: 'Bestellqueue mit allen Positionen. Status von "Ausstehend" → "In Zubereitung" → "Fertig".',
      },
      {
        label: 'Küchenstation (Wanddisplay)',
        tag: 'Station',
        tagColor: '#7c3aed',
        username: 'Küche',
        pin: '5555',
        role: 'kitchen',
        description: 'Stationslogin für das feste Küchengerät — kein persönlicher Mitarbeiter-Account.',
      },
      {
        label: 'Bar-Station (Getränke)',
        tag: 'Station',
        tagColor: '#2563eb',
        username: 'Bar',
        pin: '5555',
        role: 'kitchen',
        description: 'Bar-Display — zeigt nur Getränke-Bestellungen. Items einzeln als fertig markieren.',
        qrToken: '',
      },
      {
        label: 'Buffet-Station (Tischplan)',
        tag: 'Station',
        tagColor: '#7c3aed',
        username: 'Buffet',
        pin: '6666',
        role: 'service',
        description: 'Grafische Tischübersicht am Buffet — Tischstatus, offene Bestellungen, Buchungen.',
      },
      {
        label: 'Gast am Tisch T-2',
        tag: 'Gast',
        tagColor: 'var(--color-secondary)',
        username: '',
        pin: '',
        role: 'guest',
        description: 'Bestellt per QR-Code — wählt aus der vollständigen Karte, verfolgt den Status live.',
        qrToken: 'table-T2-e5f6g7h8',
      },
    ],
  },
  {
    emoji: '🐄',
    name: 'Viehschau-Fest',
    badge: 'Grossanlass',
    badgeColor: '#b45309',
    headline: '40 Tische · 10 Service · Grill + Buffet + Bar · Drinnen & Draussen',
    personas: [
      {
        label: 'Chef — Festleitung & Admin',
        tag: 'Admin',
        tagColor: 'var(--color-error)',
        username: 'Admin',
        pin: '0000',
        role: 'admin',
        description: 'Überblick über alles: Umsatz, Speisekarte, Mitarbeiter, Audit-Log.',
      },
      {
        label: 'Lisa — Bestellungen & Kasse',
        tag: 'Service',
        tagColor: 'var(--color-info)',
        username: 'Anna',
        pin: '1234',
        role: 'service',
        description: 'Nimmt Bestellungen auf, kassiert. Arbeitet am Buffet oder läuft durch die Tische.',
      },
      {
        label: 'Sandra — Bestellungen & Kasse',
        tag: 'Service',
        tagColor: 'var(--color-info)',
        username: 'Marco',
        pin: '1234',
        role: 'service',
        description: 'Zweite Servicekraft für Bestellungen und Kassieren.',
      },
      {
        label: 'Maria — Runnerin (nur bringen)',
        tag: 'Runner',
        tagColor: '#059669',
        username: 'Anna',
        pin: '1234',
        role: 'service',
        description: 'Sieht nur fertige Bestellungen → bringt sie zum Tisch → markiert als serviert.',
      },
      {
        label: 'Grill-Station (Handschuh-Modus)',
        tag: 'Station',
        tagColor: '#dc2626',
        username: 'Grill',
        pin: '5555',
        role: 'kitchen',
        description: 'Extra-grosse Buttons für dreckige Hände / Handschuhe. Zeigt nur Grill-Items.',
      },
      {
        label: 'Buffet-Station (Tischplan)',
        tag: 'Station',
        tagColor: '#7c3aed',
        username: 'Buffet',
        pin: '6666',
        role: 'service',
        description: 'Grafische Tischübersicht — 40 Tische, Zonen Drinnen/Draussen.',
      },
      {
        label: 'Bar-Station (Getränke)',
        tag: 'Station',
        tagColor: '#2563eb',
        username: 'Bar',
        pin: '5555',
        role: 'kitchen',
        description: 'Getränke-Display — Bier, Wein, Softdrinks. Items als fertig markieren.',
      },
      {
        label: 'Gast am Tisch (QR-Code)',
        tag: 'Gast',
        tagColor: 'var(--color-secondary)',
        username: '',
        pin: '',
        role: 'guest',
        description: 'Gäste bestellen selbst per QR-Code am Tisch — entlastet das Service-Team.',
        qrToken: 'table-T2-e5f6g7h8',
      },
    ],
  },
];

export function DemoPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handlePersona = async (persona: Persona) => {
    setError('');

    if (persona.role === 'guest' && persona.qrToken) {
      navigate(`/guest?token=${persona.qrToken}`);
      return;
    }

    const key = `${persona.username}-${persona.role}`;
    setLoading(key);
    try {
      const data = await api.login(persona.username, persona.pin);
      if (data.error) {
        setError(`Login fehlgeschlagen: ${data.error}`);
        setLoading(null);
        return;
      }
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      // Station personas go to their station route
      if (persona.username === 'Buffet') { navigate('/floor'); return; }
      if (persona.username === 'Bar') { navigate('/bar'); return; }
      if (persona.username === 'Küche') { navigate('/kitchen'); return; }
      if (persona.username === 'Grill') { navigate('/grill'); return; }
      if (persona.tag === 'Runner') { navigate('/runner'); return; }
      if (persona.tag === 'Tasks') { navigate('/tasks'); return; }
      switch (data.user.role) {
        case 'admin': navigate('/admin'); break;
        case 'kitchen': navigate('/kitchen'); break;
        default: navigate('/service'); break;
      }
    } catch {
      setError('Server nicht erreichbar. Bitte Backend starten.');
      setLoading(null);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-gray-100)', padding: '32px 16px' }}>
      <div style={{ maxWidth: '680px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <h1 style={{ fontSize: '26px', fontWeight: '700', margin: '0 0 6px 0' }}>OpenServe OS</h1>
          <p style={{ color: 'var(--color-secondary)', margin: '0 0 4px 0', fontSize: '15px' }}>Demo-Umgebung</p>
          <p style={{ color: 'var(--color-secondary)', fontSize: '13px', margin: 0 }}>
            Wähle einen Betrieb und eine Rolle — ein Klick genügt.
          </p>
        </div>

        {error && (
          <div style={{ background: 'var(--color-error)', color: 'white', padding: '12px 16px', borderRadius: 'var(--radius-md)', marginBottom: '20px', fontSize: '14px' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'grid', gap: '24px' }}>
          {RESTAURANTS.map(restaurant => (
            <div key={restaurant.name} className="card" style={{ padding: '0', overflow: 'hidden' }}>

              {/* Restaurant header */}
              <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--color-gray-200)', display: 'flex', alignItems: 'center', gap: '14px' }}>
                <span style={{ fontSize: '36px', lineHeight: 1 }}>{restaurant.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '2px' }}>
                    <h2 style={{ margin: 0, fontSize: '18px' }}>{restaurant.name}</h2>
                    <span style={{
                      background: restaurant.badgeColor,
                      color: 'white',
                      fontSize: '11px',
                      fontWeight: '700',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}>
                      {restaurant.badge}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-secondary)' }}>
                    {restaurant.headline}
                  </p>
                </div>
              </div>

              {/* Personas */}
              <div style={{ padding: '12px' }}>
                <div style={{ display: 'grid', gap: '8px' }}>
                  {restaurant.personas.map(persona => {
                    const key = `${persona.username}-${persona.role}`;
                    const isLoading = loading === key;
                    const isGuest = persona.role === 'guest';
                    return (
                      <button
                        key={key}
                        onClick={() => handlePersona(persona)}
                        disabled={!!loading}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '12px 14px',
                          background: 'var(--color-gray-100)',
                          border: '1px solid var(--color-gray-200)',
                          borderRadius: 'var(--radius-md)',
                          cursor: loading ? 'default' : 'pointer',
                          opacity: loading && !isLoading ? 0.5 : 1,
                          fontFamily: 'var(--font-system)',
                          textAlign: 'left',
                          width: '100%',
                        }}
                      >
                        {/* Role badge */}
                        <span style={{
                          flexShrink: 0,
                          fontSize: '11px',
                          fontWeight: '700',
                          color: persona.tagColor,
                          background: 'white',
                          border: `1px solid ${persona.tagColor}`,
                          padding: '2px 8px',
                          borderRadius: '10px',
                          minWidth: '58px',
                          textAlign: 'center',
                          textTransform: 'uppercase',
                          letterSpacing: '0.3px',
                        }}>
                          {persona.tag}
                        </span>

                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: '0 0 2px 0', fontSize: '14px', fontWeight: '600', color: 'var(--color-primary)' }}>
                            {isLoading ? 'Einloggen...' : persona.label}
                          </p>
                          <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-secondary)', lineHeight: '1.4' }}>
                            {persona.description}
                          </p>
                        </div>

                        {/* Credentials or arrow */}
                        {!isGuest ? (
                          <div style={{ flexShrink: 0, textAlign: 'right' }}>
                            <p style={{ margin: '0 0 1px 0', fontSize: '11px', color: 'var(--color-secondary)' }}>PIN</p>
                            <p style={{ margin: 0, fontSize: '14px', fontWeight: '700', fontFamily: 'monospace', letterSpacing: '2px' }}>
                              {persona.pin}
                            </p>
                          </div>
                        ) : (
                          <span style={{ flexShrink: 0, fontSize: '16px', color: 'var(--color-secondary)' }}>→</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: '28px' }}>
          <a href="/login" style={{ fontSize: '13px', color: 'var(--color-secondary)', textDecoration: 'none' }}>
            ← Zurück zum Login
          </a>
        </div>
      </div>
    </div>
  );
}
