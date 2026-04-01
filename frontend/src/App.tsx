import { useState } from 'react';
import { GuestUI } from './components/GuestUI';
import { KitchenDisplay } from './components/KitchenDisplay';
import { ServiceUI } from './components/ServiceUI';
import { AdminDashboard } from './components/AdminDashboard';

type View = 'guest' | 'service' | 'kitchen' | 'admin';

function App() {
  const [view, setView] = useState<View>('service');

  const navBtn = (v: View) => ({
    flex: 1,
    padding: '12px',
    border: 'none',
    background: view === v ? 'var(--color-black)' : 'transparent',
    color: view === v ? 'var(--color-white)' : 'var(--color-secondary)',
    fontFamily: 'var(--font-system)',
    fontSize: '13px',
    fontWeight: '600' as const,
    cursor: 'pointer' as const,
  });

  return (
    <div>
      <nav style={{
        display: 'flex',
        borderBottom: '1px solid var(--color-gray-200)',
        background: 'var(--color-white)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <button style={navBtn('guest')} onClick={() => setView('guest')}>Guest</button>
        <button style={navBtn('service')} onClick={() => setView('service')}>Service</button>
        <button style={navBtn('kitchen')} onClick={() => setView('kitchen')}>Kitchen</button>
        <button style={navBtn('admin')} onClick={() => setView('admin')}>Admin</button>
      </nav>

      {view === 'guest' && <GuestUI />}
      {view === 'service' && <ServiceUI />}
      {view === 'kitchen' && <KitchenDisplay />}
      {view === 'admin' && <AdminDashboard />}
    </div>
  );
}

export default App;
