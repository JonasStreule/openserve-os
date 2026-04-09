import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { generateQrPdf } from '../utils/qrPdf';
import { ConfirmModal } from './ConfirmModal';
import { showToast } from './Toast';

type AdminTab = 'dashboard' | 'products' | 'tables' | 'users' | 'audit' | 'leaderboard';

interface Metrics {
  date: string;
  orders: { total: number; by_status: Array<{ status: string; count: string }> };
  revenue: {
    total: number;
    tips: number;
    average_order: number;
    by_method: Array<{ method: string; count: string; total: string }>;
    hourly: Array<{ hour: string; total: string; count: string }>;
  };
}

interface AuditEvent {
  id: number;
  entity_type: string;
  entity_id: string;
  event_type: string;
  old_value: any;
  new_value: any;
  created_at: string;
}

interface StaffScore {
  id: string;
  username: string;
  points: number;
  orders_served: number;
  tips_earned: string;
  avg_service_time: number;
}

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  station: string;
  available: boolean;
}

interface Table {
  id: string;
  table_number: string;
  capacity: number;
  status: string;
  qr_token: string;
}

interface User {
  id: string;
  username: string;
  role: string;
  created_at: string;
}

export function AdminDashboard() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<AdminTab>('dashboard');
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditFilter, setAuditFilter] = useState('');
  const [leaderboard, setLeaderboard] = useState<StaffScore[]>([]);

  // Products state
  const [products, setProducts] = useState<Product[]>([]);
  const [productForm, setProductForm] = useState({ name: '', category: '', price: '', station: 'kitchen' });
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Tables state
  const [tables, setTables] = useState<Table[]>([]);
  const [tableForm, setTableForm] = useState({ table_number: '', capacity: '' });
  const [editingTable, setEditingTable] = useState<Table | null>(null);

  // Users state
  const [users, setUsers] = useState<User[]>([]);
  const [userForm, setUserForm] = useState({ username: '', pin: '', role: 'service' });
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Shared UI state
  const [crudError, setCrudError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  const fetchMetrics = useCallback(async () => {
    const [m, w] = await Promise.all([api.getMetrics(), api.getWeeklyMetrics()]);
    setMetrics(m);
    setWeeklyData(w.days || []);
  }, []);

  const fetchAudit = useCallback(async () => {
    const data = await api.getAuditLog(50, 0, auditFilter || undefined);
    setAuditEvents(data.events || []);
    setAuditTotal(data.total || 0);
  }, [auditFilter]);

  const fetchLeaderboard = useCallback(async () => {
    const data = await api.getLeaderboard('daily');
    setLeaderboard(data.leaderboard || []);
  }, []);

  const fetchProducts = useCallback(async () => {
    const data = await api.getProducts();
    setProducts(data.products || []);
  }, []);

  const fetchTables = useCallback(async () => {
    const data = await api.getTables();
    setTables(data.tables || []);
  }, []);

  const fetchUsers = useCallback(async () => {
    const data = await api.getUsers();
    setUsers(data.users || []);
  }, []);

  useEffect(() => {
    fetchMetrics();
    fetchLeaderboard();
  }, [fetchMetrics, fetchLeaderboard]);

  useEffect(() => { fetchAudit(); }, [fetchAudit]);

  useEffect(() => {
    if (tab === 'products') fetchProducts();
    if (tab === 'tables') fetchTables();
    if (tab === 'users') fetchUsers();
  }, [tab, fetchProducts, fetchTables, fetchUsers]);

  useEffect(() => {
    const interval = setInterval(fetchMetrics, 10000);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const tabStyle = (active: boolean) => ({
    flex: 1,
    padding: '10px 6px',
    border: 'none',
    borderBottom: active ? '2px solid var(--color-black)' : '2px solid transparent',
    background: 'transparent',
    color: active ? 'var(--color-primary)' : 'var(--color-secondary)',
    fontFamily: 'var(--font-system)',
    fontSize: '13px',
    fontWeight: active ? '600' as const : '400' as const,
    cursor: 'pointer',
  });

  const statCard = (label: string, value: string, sub?: string, color?: string) => (
    <div className="card" style={{ textAlign: 'center', padding: '20px' }}>
      <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: 'var(--color-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</p>
      <p style={{ margin: '0 0 2px 0', fontSize: '28px', fontWeight: '700', color: color || 'var(--color-primary)' }}>{value}</p>
      {sub && <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-secondary)' }}>{sub}</p>}
    </div>
  );

  const getMedal = (index: number) => {
    if (index === 0) return '\u{1F947}';
    if (index === 1) return '\u{1F948}';
    if (index === 2) return '\u{1F949}';
    return `#${index + 1}`;
  };

  // Product CRUD handlers
  const handleSaveProduct = async () => {
    setSaving(true);
    setCrudError('');
    try {
      const price = parseFloat(productForm.price);
      if (!productForm.name.trim() || isNaN(price) || price < 0) {
        setCrudError('Name und gültiger Preis erforderlich');
        setSaving(false);
        return;
      }
      const data = { name: productForm.name.trim(), category: productForm.category, price, station: productForm.station };
      if (editingProduct) {
        await api.updateProduct(editingProduct.id, data);
      } else {
        await api.createProduct(data);
      }
      setProductForm({ name: '', category: '', price: '', station: 'kitchen' });
      setEditingProduct(null);
      showToast(editingProduct ? 'Produkt aktualisiert' : 'Produkt hinzugefügt', 'success');
      fetchProducts();
    } catch {
      setCrudError('Produkt konnte nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  };

  const handleEditProduct = (p: Product) => {
    setCrudError('');
    setEditingProduct(p);
    setProductForm({ name: p.name, category: p.category, price: String(p.price), station: p.station || 'kitchen' });
  };

  const handleDeleteProduct = (id: string) => {
    const product = products.find(p => p.id === id);
    setConfirmAction({
      title: 'Produkt löschen',
      message: `"${product?.name || 'Produkt'}" wirklich löschen? Dies kann nicht rückgängig gemacht werden.`,
      onConfirm: async () => {
        setCrudError('');
        setConfirmAction(null);
        try {
          await api.deleteProduct(id);
          showToast('Produkt gelöscht', 'success');
          fetchProducts();
        } catch {
          setCrudError('Produkt konnte nicht gelöscht werden.');
        }
      },
    });
  };

  // Table CRUD handlers
  const handleSaveTable = async () => {
    setSaving(true);
    setCrudError('');
    try {
      const capacity = parseInt(tableForm.capacity, 10);
      if (!tableForm.table_number.trim() || isNaN(capacity) || capacity < 1) {
        setCrudError('Tischnummer und gültige Kapazität erforderlich');
        setSaving(false);
        return;
      }
      const data = { table_number: tableForm.table_number.trim(), capacity };
      if (editingTable) {
        await api.updateTable(editingTable.id, data);
      } else {
        await api.createTable(data);
      }
      setTableForm({ table_number: '', capacity: '' });
      setEditingTable(null);
      showToast(editingTable ? 'Tisch aktualisiert' : 'Tisch hinzugefügt', 'success');
      fetchTables();
    } catch {
      setCrudError('Tisch konnte nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  };

  const handleEditTable = (t: Table) => {
    setCrudError('');
    setEditingTable(t);
    setTableForm({ table_number: t.table_number, capacity: String(t.capacity) });
  };

  const handleDeleteTable = (id: string) => {
    const table = tables.find(t => t.id === id);
    setConfirmAction({
      title: 'Tisch löschen',
      message: `Tisch "${table?.table_number || ''}" wirklich löschen? Dies kann nicht rückgängig gemacht werden.`,
      onConfirm: async () => {
        setCrudError('');
        setConfirmAction(null);
        try {
          await api.deleteTable(id);
          showToast('Tisch gelöscht', 'success');
          fetchTables();
        } catch {
          setCrudError('Tisch konnte nicht gelöscht werden.');
        }
      },
    });
  };

  // User CRUD handlers
  const handleSaveUser = async () => {
    setSaving(true);
    setCrudError('');
    try {
      const data: any = { username: userForm.username, role: userForm.role };
      if (userForm.pin) data.pin = userForm.pin;
      if (editingUser) {
        await api.updateUser(editingUser.id, data);
      } else {
        await api.createUser(data);
      }
      setUserForm({ username: '', pin: '', role: 'service' });
      setEditingUser(null);
      showToast(editingUser ? 'Mitarbeiter aktualisiert' : 'Mitarbeiter hinzugefügt', 'success');
      fetchUsers();
    } catch {
      setCrudError('Mitarbeiter konnte nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  };

  const handleEditUser = (u: User) => {
    setCrudError('');
    setEditingUser(u);
    setUserForm({ username: u.username, pin: '', role: u.role });
  };

  const handleDeleteUser = (id: string) => {
    const user = users.find(u => u.id === id);
    setConfirmAction({
      title: 'Mitarbeiter löschen',
      message: `"${user?.username || 'Mitarbeiter'}" wirklich löschen? Der Zugang wird sofort gesperrt.`,
      onConfirm: async () => {
        setCrudError('');
        setConfirmAction(null);
        try {
          await api.deleteUser(id);
          showToast('Mitarbeiter gelöscht', 'success');
          fetchUsers();
        } catch {
          setCrudError('Mitarbeiter konnte nicht gelöscht werden.');
        }
      },
    });
  };

  const inputStyle = { marginBottom: '8px', height: '40px', fontSize: '14px' };
  const smallBtn = (color?: string) => ({
    padding: '4px 12px',
    fontSize: '12px',
    background: color || undefined,
    height: '32px',
  });

  return (
    <div style={{ padding: '16px', maxWidth: '960px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h1 style={{ margin: 0, fontSize: '24px' }}>Admin</h1>
        <button className="button secondary" onClick={handleLogout} style={{ fontSize: '13px', height: '36px', color: 'var(--color-error)' }}>
          Abmelden
        </button>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid var(--color-gray-200)', marginBottom: '16px', overflowX: 'auto' }}>
        <button style={tabStyle(tab === 'dashboard')} onClick={() => setTab('dashboard')}>Übersicht</button>
        <button style={tabStyle(tab === 'products')} onClick={() => setTab('products')}>Speisekarte</button>
        <button style={tabStyle(tab === 'tables')} onClick={() => setTab('tables')}>Tische</button>
        <button style={tabStyle(tab === 'users')} onClick={() => setTab('users')}>Mitarbeiter</button>
        <button style={tabStyle(tab === 'audit')} onClick={() => setTab('audit')}>Protokoll</button>
        <button style={tabStyle(tab === 'leaderboard')} onClick={() => setTab('leaderboard')}>Rangliste</button>
      </div>

      {crudError && (
        <div style={{ padding: '10px 14px', background: 'var(--color-error)', color: 'white', borderRadius: 'var(--radius-md)', marginBottom: '12px', fontSize: '14px' }}>
          {crudError}
        </div>
      )}

      {/* Dashboard Tab */}
      {tab === 'dashboard' && metrics && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '20px' }}>
            {statCard('Umsatz', `CHF ${metrics.revenue.total.toFixed(2)}`)}
            {statCard('Bestellungen', `${metrics.orders.total}`)}
            {statCard('Ø Bestellung', `CHF ${metrics.revenue.average_order.toFixed(2)}`)}
            {statCard('Trinkgeld', `CHF ${metrics.revenue.tips.toFixed(2)}`, undefined, 'var(--color-success)')}
          </div>

          <div className="card" style={{ marginBottom: '12px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '16px' }}>Bestellungen nach Status</h3>
            {metrics.orders.by_status.length === 0 && (
              <p style={{ color: 'var(--color-secondary)', fontSize: '14px' }}>Heute noch keine Bestellungen</p>
            )}
            {metrics.orders.by_status.map((s, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < metrics.orders.by_status.length - 1 ? '1px solid var(--color-gray-200)' : 'none' }}>
                <span style={{ textTransform: 'capitalize' }}>{s.status}</span>
                <span style={{ fontWeight: '600' }}>{s.count}</span>
              </div>
            ))}
          </div>

          <div className="card" style={{ marginBottom: '12px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '16px' }}>Zahlungsarten</h3>
            {metrics.revenue.by_method.length === 0 && (
              <p style={{ color: 'var(--color-secondary)', fontSize: '14px' }}>Heute noch keine Zahlungen</p>
            )}
            {metrics.revenue.by_method.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < metrics.revenue.by_method.length - 1 ? '1px solid var(--color-gray-200)' : 'none' }}>
                <span style={{ textTransform: 'capitalize' }}>{m.method} ({m.count}x)</span>
                <span style={{ fontWeight: '600' }}>CHF {parseFloat(m.total).toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div className="card">
            <h3 style={{ margin: '0 0 12px 0', fontSize: '16px' }}>Letzte 7 Tage</h3>
            {weeklyData.length === 0 && (
              <p style={{ color: 'var(--color-secondary)', fontSize: '14px' }}>Noch keine Daten</p>
            )}
            {weeklyData.map((day, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < weeklyData.length - 1 ? '1px solid var(--color-gray-200)' : 'none' }}>
                <span style={{ fontSize: '14px' }}>{new Date(day.date).toLocaleDateString('de-CH', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontWeight: '600' }}>CHF {parseFloat(day.revenue).toFixed(2)}</span>
                  <span style={{ marginLeft: '12px', color: 'var(--color-secondary)', fontSize: '13px' }}>{day.orders} Bestell.</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Products Tab */}
      {tab === 'products' && (
        <div>
          <div className="card" style={{ marginBottom: '16px', padding: '16px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '16px' }}>{editingProduct ? 'Produkt bearbeiten' : 'Produkt hinzufügen'}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px', marginBottom: '8px' }}>
              <input style={inputStyle} placeholder="Name" value={productForm.name} onChange={e => setProductForm(f => ({ ...f, name: e.target.value }))} />
              <input style={inputStyle} placeholder="Kategorie" value={productForm.category} onChange={e => setProductForm(f => ({ ...f, category: e.target.value }))} />
              <input style={inputStyle} placeholder="Preis (CHF)" type="number" value={productForm.price} onChange={e => setProductForm(f => ({ ...f, price: e.target.value }))} />
              <select
                value={productForm.station}
                onChange={e => setProductForm(f => ({ ...f, station: e.target.value }))}
                style={{ ...inputStyle, padding: '0 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-gray-200)', fontFamily: 'var(--font-system)', width: '100%' }}
              >
                <option value="kitchen">Küche</option>
                <option value="bar">Bar</option>
                <option value="grill">Grill</option>
                <option value="direct">Direkt</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="button primary" onClick={handleSaveProduct} disabled={!productForm.name || !productForm.price || saving} style={{ fontSize: '14px', height: '36px' }}>
                {saving ? 'Speichern...' : editingProduct ? 'Aktualisieren' : 'Hinzufügen'}
              </button>
              {editingProduct && (
                <button className="button secondary" onClick={() => { setEditingProduct(null); setProductForm({ name: '', category: '', price: '', station: 'kitchen' }); }} style={{ fontSize: '14px', height: '36px' }}>
                  Abbrechen
                </button>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gap: '8px' }}>
            {products.map(p => (
              <div key={p.id} className="card" style={{ padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: '600' }}>{p.name}</span>
                  <span style={{ fontSize: '13px', color: 'var(--color-secondary)' }}>{p.category}</span>
                  <span style={{
                    fontSize: '10px', fontWeight: '700', textTransform: 'uppercase',
                    padding: '2px 6px', borderRadius: '8px',
                    background: p.station === 'bar' ? '#dbeafe' : p.station === 'direct' ? '#fef3c7' : '#d1fae5',
                    color: p.station === 'bar' ? '#1e40af' : p.station === 'direct' ? '#92400e' : '#065f46',
                  }}>
                    {p.station === 'bar' ? 'Bar' : p.station === 'grill' ? 'Grill' : p.station === 'direct' ? 'Direkt' : 'Küche'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: '600' }}>CHF {parseFloat(String(p.price)).toFixed(2)}</span>
                  <button className="button secondary" onClick={() => handleEditProduct(p)} style={smallBtn()}>Bearb.</button>
                  <button className="button secondary" onClick={() => handleDeleteProduct(p.id)} style={smallBtn('var(--color-error)')}>Löschen</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tables Tab */}
      {tab === 'tables' && (
        <div>
          <div className="card" style={{ marginBottom: '16px', padding: '16px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '16px' }}>{editingTable ? 'Tisch bearbeiten' : 'Tisch hinzufügen'}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
              <input style={inputStyle} placeholder="Tischnummer (z.B. T-7)" value={tableForm.table_number} onChange={e => setTableForm(f => ({ ...f, table_number: e.target.value }))} />
              <input style={inputStyle} placeholder="Sitzplätze" type="number" value={tableForm.capacity} onChange={e => setTableForm(f => ({ ...f, capacity: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="button primary" onClick={handleSaveTable} disabled={!tableForm.table_number || saving} style={{ fontSize: '14px', height: '36px' }}>
                {saving ? 'Speichern...' : editingTable ? 'Aktualisieren' : 'Hinzufügen'}
              </button>
              {editingTable && (
                <button className="button secondary" onClick={() => { setEditingTable(null); setTableForm({ table_number: '', capacity: '' }); }} style={{ fontSize: '14px', height: '36px' }}>
                  Abbrechen
                </button>
              )}
              <button
                className="button secondary"
                onClick={() => generateQrPdf(tables)}
                disabled={tables.length === 0}
                style={{ fontSize: '14px', height: '36px', marginLeft: 'auto' }}
              >
                QR-Codes drucken
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gap: '8px' }}>
            {tables.map(t => (
              <div key={t.id} className="card" style={{ padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontWeight: '600' }}>Tisch {t.table_number}</span>
                  <span style={{ marginLeft: '8px', fontSize: '13px', color: 'var(--color-secondary)' }}>{t.capacity} Plätze</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--color-secondary)', fontFamily: 'monospace' }}>
                    /guest?token={t.qr_token}
                  </span>
                  <button className="button secondary" onClick={() => handleEditTable(t)} style={smallBtn()}>Bearb.</button>
                  <button className="button secondary" onClick={() => handleDeleteTable(t.id)} style={smallBtn('var(--color-error)')}>Löschen</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Users Tab */}
      {tab === 'users' && (
        <div>
          <div className="card" style={{ marginBottom: '16px', padding: '16px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '16px' }}>{editingUser ? 'Mitarbeiter bearbeiten' : 'Mitarbeiter hinzufügen'}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '8px' }}>
              <input style={inputStyle} placeholder="Benutzername" value={userForm.username} onChange={e => setUserForm(f => ({ ...f, username: e.target.value }))} />
              <input style={inputStyle} placeholder={editingUser ? 'Neuer PIN (leer lassen)' : 'PIN'} type="password" value={userForm.pin} onChange={e => setUserForm(f => ({ ...f, pin: e.target.value }))} />
              <select
                value={userForm.role}
                onChange={e => setUserForm(f => ({ ...f, role: e.target.value }))}
                style={{ ...inputStyle, padding: '0 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-gray-200)', fontFamily: 'var(--font-system)', width: '100%' }}
              >
                <option value="service">Service</option>
                <option value="kitchen">Küche</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="button primary" onClick={handleSaveUser} disabled={!userForm.username || (!editingUser && !userForm.pin) || saving} style={{ fontSize: '14px', height: '36px' }}>
                {saving ? 'Speichern...' : editingUser ? 'Aktualisieren' : 'Hinzufügen'}
              </button>
              {editingUser && (
                <button className="button secondary" onClick={() => { setEditingUser(null); setUserForm({ username: '', pin: '', role: 'service' }); }} style={{ fontSize: '14px', height: '36px' }}>
                  Abbrechen
                </button>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gap: '8px' }}>
            {users.map(u => (
              <div key={u.id} className="card" style={{ padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontWeight: '600' }}>{u.username}</span>
                  <span style={{
                    marginLeft: '8px',
                    fontSize: '11px',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    color: u.role === 'admin' ? 'var(--color-error)' : u.role === 'kitchen' ? 'var(--color-info)' : 'var(--color-success)',
                  }}>
                    {u.role}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="button secondary" onClick={() => handleEditUser(u)} style={smallBtn()}>Bearb.</button>
                  <button className="button secondary" onClick={() => handleDeleteUser(u.id)} style={smallBtn('var(--color-error)')}>Löschen</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Audit Log Tab */}
      {tab === 'audit' && (
        <div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'center' }}>
            <select
              value={auditFilter}
              onChange={e => setAuditFilter(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-gray-200)', fontFamily: 'var(--font-system)', fontSize: '14px' }}
            >
              <option value="">Alle Ereignisse</option>
              <option value="order">Bestellungen</option>
              <option value="payment">Zahlungen</option>
              <option value="cash_session">Kassensitzungen</option>
            </select>
            <span style={{ color: 'var(--color-secondary)', fontSize: '13px' }}>{auditTotal} Einträge</span>
          </div>

          <div style={{ display: 'grid', gap: '8px' }}>
            {auditEvents.length === 0 && (
              <p style={{ textAlign: 'center', color: 'var(--color-secondary)', marginTop: '40px' }}>Keine Protokolleinträge</p>
            )}
            {auditEvents.map(event => (
              <div key={event.id} className="card" style={{ padding: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', color: 'var(--color-info)', letterSpacing: '0.5px' }}>
                      {event.entity_type}
                    </span>
                    <p style={{ margin: '4px 0 0 0', fontSize: '14px', fontWeight: '500' }}>{event.event_type}</p>
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--color-secondary)' }}>
                    {new Date(event.created_at).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                {(event.new_value || event.old_value) && (
                  <pre style={{ margin: '8px 0 0 0', padding: '8px', background: 'var(--color-gray-100)', borderRadius: '4px', fontSize: '11px', overflow: 'auto', maxHeight: '80px' }}>
                    {JSON.stringify(event.new_value || event.old_value, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Leaderboard Tab */}
      {tab === 'leaderboard' && (
        <div>
          {leaderboard.length === 0 && (
            <div style={{ textAlign: 'center', marginTop: '40px' }}>
              <p style={{ color: 'var(--color-secondary)', fontSize: '16px' }}>Heute noch keine Auswertung</p>
            </div>
          )}
          <div style={{ display: 'grid', gap: '8px' }}>
            {leaderboard.map((staff, index) => (
              <div key={staff.id} className="card" style={{ padding: '16px', border: index < 3 ? '2px solid var(--color-warning)' : undefined }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '24px', minWidth: '40px', textAlign: 'center' }}>{getMedal(index)}</span>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: '0 0 2px 0', fontSize: '16px' }}>{staff.username}</h3>
                    <span style={{ fontSize: '12px', color: 'var(--color-secondary)' }}>
                      {staff.orders_served} Bestell. | CHF {parseFloat(staff.tips_earned).toFixed(2)} Trinkgeld
                    </span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '24px', fontWeight: '700' }}>{staff.points}</span>
                    <p style={{ margin: 0, fontSize: '11px', color: 'var(--color-secondary)' }}>Punkte</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      {confirmAction && (
        <ConfirmModal
          title={confirmAction.title}
          message={confirmAction.message}
          confirmLabel="Ja, löschen"
          onConfirm={confirmAction.onConfirm}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}
