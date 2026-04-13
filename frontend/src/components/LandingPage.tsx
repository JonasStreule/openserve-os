import { useNavigate } from 'react-router-dom';

const FEATURES = [
  { emoji: '📱', title: 'Gast-Bestellung per QR', desc: 'Gäste scannen den Tisch-Code und bestellen direkt vom Handy. Keine App nötig.' },
  { emoji: '🍽️', title: 'Service-Dashboard', desc: 'Bestellungen verwalten, Zahlungen entgegennehmen (Karte, Bargeld, Twint), Kasse führen.' },
  { emoji: '👨‍🍳', title: 'Küchen-Display', desc: 'Live-Bestellqueue mit allen Positionen. Status-Updates in Echtzeit via WebSocket.' },
  { emoji: '🗺️', title: 'Grafischer Tischplan', desc: 'Übersicht über alle Tische auf einen Blick. Bestellungen direkt auf den Tisch buchen.' },
  { emoji: '📊', title: 'Admin & Analytics', desc: 'Tagesumsätze, Audit-Log, Mitarbeiter-Leaderboard. Speisekarte und Personal verwalten.' },
  { emoji: '🔒', title: 'Rollen & Stationen', desc: 'Persönliche Logins für Mitarbeiter. Stationslogins für Küche und Buffet-Display.' },
];


export function LandingPage() {
  const navigate = useNavigate();

  return (
    <div style={{ fontFamily: 'var(--font-system)', color: 'var(--color-primary)' }}>

      {/* Nav */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--color-gray-200)', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '56px' }}>
        <span style={{ fontWeight: '700', fontSize: '18px' }}>immerdra.ch</span>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <a href="#funktionen" style={{ fontSize: '14px', color: 'var(--color-secondary)', textDecoration: 'none' }}>Funktionen</a>
          <button className="button secondary" style={{ height: '36px', fontSize: '14px' }} onClick={() => navigate('/demo')}>
            Demo
          </button>
          <button className="button primary" style={{ height: '36px', fontSize: '14px' }} onClick={() => navigate('/login')}>
            Login
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ textAlign: 'center', padding: '80px 24px 60px', maxWidth: '720px', margin: '0 auto' }}>
        <div style={{ display: 'inline-block', background: 'var(--color-gray-100)', borderRadius: '20px', padding: '4px 14px', fontSize: '13px', fontWeight: '600', color: 'var(--color-info)', marginBottom: '20px' }}>
          Jetzt in Beta — kostenlos ausprobieren
        </div>
        <h1 style={{ fontSize: 'clamp(32px, 6vw, 56px)', fontWeight: '800', lineHeight: '1.1', margin: '0 0 20px 0', letterSpacing: '-1px' }}>
          Das POS-System für moderne Restaurants
        </h1>
        <p style={{ fontSize: 'clamp(16px, 2.5vw, 20px)', color: 'var(--color-secondary)', lineHeight: '1.6', margin: '0 0 36px 0', maxWidth: '560px', marginLeft: 'auto', marginRight: 'auto' }}>
          Gäste bestellen per QR-Code. Service hat alles im Blick. Die Küche sieht jeden Bon sofort. Alles in einem System — ohne Abo-Fallen.
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            className="button primary"
            style={{ height: '52px', fontSize: '17px', padding: '0 32px', borderRadius: '12px' }}
            onClick={() => navigate('/demo')}
          >
            Kostenlos ausprobieren →
          </button>
          <button
            className="button secondary"
            style={{ height: '52px', fontSize: '17px', padding: '0 32px', borderRadius: '12px' }}
            onClick={() => document.getElementById('funktionen')?.scrollIntoView({ behavior: 'smooth' })}
          >
            Mehr erfahren
          </button>
        </div>
        <p style={{ marginTop: '16px', fontSize: '13px', color: 'var(--color-secondary)' }}>
          Keine Kreditkarte. Keine Installation. Läuft im Browser.
        </p>
      </section>

      {/* Demo preview strip */}
      <section style={{ background: 'var(--color-gray-100)', padding: '32px 24px', textAlign: 'center', borderTop: '1px solid var(--color-gray-200)', borderBottom: '1px solid var(--color-gray-200)' }}>
        <p style={{ margin: '0 0 20px 0', fontSize: '14px', fontWeight: '600', color: 'var(--color-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>
          Zwei Demo-Betriebe — sofort spielbereit
        </p>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
          {[
            { emoji: '🚚', name: 'Street Bites', desc: 'Foodtruck · Einfach', pin: '0101' },
            { emoji: '🍝', name: 'Ristorante Mezzaluna', desc: 'Restaurant · Vollbetrieb', pin: '1234' },
          ].map(r => (
            <div key={r.name} className="card" style={{ padding: '16px 24px', minWidth: '200px', cursor: 'pointer' }} onClick={() => navigate('/demo')}>
              <span style={{ fontSize: '28px' }}>{r.emoji}</span>
              <p style={{ margin: '8px 0 2px 0', fontWeight: '600', fontSize: '15px' }}>{r.name}</p>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-secondary)' }}>{r.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="funktionen" style={{ padding: '72px 24px', maxWidth: '900px', margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: '700', margin: '0 0 48px 0' }}>
          Alles was ein Restaurant braucht
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
          {FEATURES.map(f => (
            <div key={f.title} className="card" style={{ padding: '24px' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>{f.emoji}</div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600' }}>{f.title}</h3>
              <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-secondary)', lineHeight: '1.5' }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section style={{ background: 'var(--color-gray-100)', padding: '72px 24px', borderTop: '1px solid var(--color-gray-200)' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: '700', margin: '0 0 48px 0' }}>In 3 Schritten live</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '32px' }}>
            {[
              { step: '1', title: 'Demo ausprobieren', desc: 'Klick auf "Kostenlos ausprobieren" — kein Account nötig.' },
              { step: '2', title: 'Kontakt aufnehmen', desc: 'Jonas richtet euren Betrieb in 15 Min ein und schickt die Zugangsdaten.' },
              { step: '3', title: 'Loslegen', desc: 'QR-Codes drucken, Geräte einrichten — fertig. Keine IT nötig.' },
            ].map(s => (
              <div key={s.step} style={{ textAlign: 'center' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--color-black)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '20px', margin: '0 auto 16px auto' }}>
                  {s.step}
                </div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>{s.title}</h3>
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-secondary)', lineHeight: '1.5' }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ background: 'var(--color-black)', color: 'white', padding: '72px 24px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 'clamp(24px, 4vw, 40px)', fontWeight: '700', margin: '0 0 16px 0', color: 'white' }}>
          Bereit für das moderne POS-System?
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '16px', margin: '0 0 32px 0' }}>
          Keine Kreditkarte. Keine Installation. In 2 Minuten ausprobiert.
        </p>
        <button
          className="button"
          style={{ height: '52px', fontSize: '17px', padding: '0 40px', borderRadius: '12px', background: 'white', color: 'black' }}
          onClick={() => navigate('/demo')}
        >
          Jetzt kostenlos ausprobieren →
        </button>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--color-gray-200)', padding: '32px 24px', textAlign: 'center', fontSize: '13px', color: 'var(--color-secondary)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', flexWrap: 'wrap', marginBottom: '12px' }}>
          <a href="mailto:admin@immerdra.ch" style={{ color: 'var(--color-info)', textDecoration: 'none' }}>admin@immerdra.ch</a>
          <a href="tel:+41786491945" style={{ color: 'var(--color-secondary)', textDecoration: 'none' }}>+41 78 649 19 45</a>
        </div>
        <p style={{ margin: 0 }}>
          © {new Date().getFullYear()} immerdra.ch — Ein Projekt von edv.sg ·{' '}
          <a href="mailto:kontakt@edv.sg" style={{ color: 'var(--color-secondary)', textDecoration: 'none' }}>Kontakt</a>
        </p>
      </footer>
    </div>
  );
}
