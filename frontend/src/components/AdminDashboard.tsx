import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

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
  const [productForm, setProductForm] = useState({ name: '', category: '', price: '' });
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Tables state
  const [tables, setTables] = useState<Table[]>([]);
  const [tableForm, setTableForm] = useState({ table_number: '', capacity: '' });
  const [editingTable, setEditingTable] = useState<Table | null>(null);

  // Users state
  const [users, setUsers] = useState<User[]>([]);
  const [userForm, setUserForm] = useState({ username: '', pin: '', role: 'service' });
  const [editingUser, setEditingUser] = useState<User | null>(null);

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
    const data = { name: productForm.name, category: productForm.category, price: parseFloat(productForm.price) };
    if (editingProduct) {
      await api.updateProduct(editingProduct.id, data);
    } else {
      await api.createProduct(data);
    }
    setProductForm({ name: '', category: '', price: '' });
    setEditingProduct(null);
    fetchProducts();
  };

  const handleEditProduct = (p: Product) => {
    setEditingProduct(p);
    setProductForm({ name: p.name, category: p.category, price: String(p.price) });
  };

  const handleDeleteProduct = async (id: string) => {
    await api.deleteProduct(id);
    fetchProducts();
  };

  // Table CRUD handlers
  const handleSaveTable = async () => {
    const data = { table_number: tableForm.table_number, capacity: parseInt(tableForm.capacity) };
    if (editingTable) {
      await api.updateTable(editingTable.id, data);
    } else {
      await api.createTable(data);
    }
    setTableForm({ table_number: '', capacity: '' });
    setEditingTable(null);
    fetchTables();
  };

  const handleEditTable = (t: Table) => {
    setEditingTable(t);
    setTableForm({ table_number: t.table_number, capacity: String(t.capacity) });
  };

  const handleDeleteTable = async (id: string) => {
    await api.deleteTable(id);
    fetchTables();
  };

  // User CRUD handlers
  const handleSaveUser = async () => {
    const data: any = { username: userForm.username, role: userForm.role };
    if (userForm.pin) data.pin = userForm.pin;
    if (editingUser) {
      await api.updateUser(editingUser.id, data);
    } else {
      await api.createUser(data);
    }
    setUserForm({ username: '', pin: '', role: 'service' });
    setEditingUser(null);
    fetchUsers();
  };

  const handleEditUser = (u: User) => {
    setEditingUser(u);
    setUserForm({ username: u.username, pin: '', role: u.role });
  };

  const handleDeleteUser = async (id: string) => {
    await api.deleteUser(id);
    fetchUsers();
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
          Logout
        </button>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid var(--color-gray-200)', marginBottom: '16px', overflowX: 'auto' }}>
        <button style={tabStyle(tab === 'dashboard')} onClick={() => setTab('dashboard')}>Dashboard</button>
        <button style={tabStyle(tab === 'products')} onClick={() => setTab('products')}>Products</button>
        <button style={tabStyle(tab === 'tables')} onClick={() => setTab('tables')}>Tables</button>
        <button style={tabStyle(tab === 'users')} onClick={() => setTab('users')}>Users</button>
        <button style={tabStyle(tab === 'audit')} onClick={() => setTab('audit')}>Audit</button>
        <button style={tabStyle(tab === 'leaderboard')} onClick={() => setTab('leaderboard')}>Leaderboard</button>
      </div>

      {/* Dashboard Tab */}
      {tab === 'dashboard' && metrics && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '20px' }}>
            {statCard('Revenue', `CHF ${metrics.revenue.total.toFixed(2)}`)}
            {statCard('Orders', `${metrics.orders.total}`)}
            {statCard('Avg. Order', `CHF ${metrics.revenue.average_order.toFixed(2)}`)}
            {statCard('Tips', `CHF ${metrics.revenue.tips.toFixed(2)}`, undefined, 'var(--color-success)')}
          </div>

          <div className="card" style={{ marginBottom: '12px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '16px' }}>Orders by Status</h3>
            {metrics.orders.by_status.length === 0 && (
              <p style={{ color: 'var(--color-secondary)', fontSize: '14px' }}>No orders today</p>
            )}
            {metrics.orders.by_status.map((s, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < metrics.orders.by_status.length - 1 ? '1px solid var(--color-gray-200)' : 'none' }}>
                <span style={{ textTransform: 'capitalize' }}>{s.status}</span>
                <span style={{ fontWeight: '600' }}>{s.count}</span>
              </div>
            ))}
          </div>

          <div className="card" style={{ marginBottom: '12px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '16px' }}>Payment Methods</h3>
            {metrics.revenue.by_method.length === 0 && (
              <p style={{ color: 'var(--color-secondary)', fontSize: '14px' }}>No payments today</p>
            )}
            {metrics.revenue.by_method.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < metrics.revenue.by_method.length - 1 ? '1px solid var(--color-gray-200)' : 'none' }}>
                <span style={{ textTransform: 'capitalize' }}>{m.method} ({m.count}x)</span>
                <span style={{ fontWeight: '600' }}>CHF {parseFloat(m.total).toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div className="card">
            <h3 style={{ margin: '0 0 12px 0', fontSize: '16px' }}>Last 7 Days</h3>
            {weeklyData.length === 0 && (
              <p style={{ color: 'var(--color-secondary)', fontSize: '14px' }}>No data yet</p>
            )}
            {weeklyData.map((day, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < weeklyData.length - 1 ? '1px solid var(--color-gray-200)' : 'none' }}>
                <span style={{ fontSize: '14px' }}>{new Date(day.date).toLocaleDateString('de-CH', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontWeight: '600' }}>CHF {parseFloat(day.revenue).toFixed(2)}</span>
                  <span style={{ marginLeft: '12px', color: 'var(--color-secondary)', fontSize: '13px' }}>{day.orders} orders</span>
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
            <h3 style={{ margin: '0 0 12px 0', fontSize: '16px' }}>{editingProduct ? 'Edit Product' : 'Add Product'}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '8px' }}>
              <input style={inputStyle} placeholder="Name" value={productForm.name} onChange={e => setProductForm(f => ({ ...f, name: e.target.value }))} />
              <input style={inputStyle} placeholder="Category" value={productForm.category} onChange={e => setProductForm(f => ({ ...f, category: e.target.value }))} />
              <input style={inputStyle} placeholder="Price (CHF)" type="number" value={productForm.price} onChange={e => setProductForm(f => ({ ...f, price: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="button primary" onClick={handleSaveProduct} disabled={!productForm.name || !productForm.price} style={{ fontSize: '14px', height: '36px' }}>
                {editingProduct ? 'Update' : 'Add'}
              </button>
              {editingProduct && (
                <button className="button secondary" onClick={() => { setEditingProduct(null); setProductForm({ name: '', category: '', price: '' }); }} style={{ fontSize: '14px', height: '36px' }}>
                  Cancel
                </button>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gap: '8px' }}>
            {products.map(p => (
              <div key={p.id} className="card" style={{ padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontWeight: '600' }}>{p.name}</span>
                  <span style={{ marginLeft: '8px', fontSize: '13px', color: 'var(--color-secondary)' }}>{p.category}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: '600' }}>CHF {parseFloat(String(p.price)).toFixed(2)}</span>
                  <button className="button secondary" onClick={() => handleEditProduct(p)} style={smallBtn()}>Edit</button>
                  <button className="button secondary" onClick={() => handleDeleteProduct(p.id)} style={smallBtn('var(--color-error)')}>Delete</button>
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
            <h3 style={{ margin: '0 0 12px 0', fontSize: '16px' }}>{editingTable ? 'Edit Table' : 'Add Table'}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
              <input style={inputStyle} placeholder="Table number (e.g. T-7)" value={tableForm.table_number} onChange={e => setTableForm(f => ({ ...f, table_number: e.target.value }))} />
              <input style={inputStyle} placeholder="Capacity" type="number" value={tableForm.capacity} onChange={e => setTableForm(f => ({ ...f, capacity: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="button primary" onClick={handleSaveTable} disabled={!tableForm.table_number} style={{ fontSize: '14px', height: '36px' }}>
                {editingTable ? 'Update' : 'Add'}
              </button>
              {editingTable && (
                <button className="button secondary" onClick={() => { setEditingTable(null); setTableForm({ table_number: '', capacity: '' }); }} style={{ fontSize: '14px', height: '36px' }}>
                  Cancel
                </button>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gap: '8px' }}>
            {tables.map(t => (
              <div key={t.id} className="card" style={{ padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontWeight: '600' }}>Table {t.table_number}</span>
                  <span style={{ marginLeft: '8px', fontSize: '13px', color: 'var(--color-secondary)' }}>Seats {t.capacity}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--color-secondary)', fontFamily: 'monospace' }}>
                    /guest?token={t.qr_token}
                  </span>
                  <button className="button secondary" onClick={() => handleEditTable(t)} style={smallBtn()}>Edit</button>
                  <button className="button secondary" onClick={() => handleDeleteTable(t.id)} style={smallBtn('var(--color-error)')}>Delete</button>
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
            <h3 style={{ margin: '0 0 12px 0', fontSize: '16px' }}>{editingUser ? 'Edit User' : 'Add User'}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '8px' }}>
              <input style={inputStyle} placeholder="Username" value={userForm.username} onChange={e => setUserForm(f => ({ ...f, username: e.target.value }))} />
              <input style={inputStyle} placeholder={editingUser ? 'New PIN (leave blank)' : 'PIN'} type="password" value={userForm.pin} onChange={e => setUserForm(f => ({ ...f, pin: e.target.value }))} />
              <select
                value={userForm.role}
                onChange={e => setUserForm(f => ({ ...f, role: e.target.value }))}
                style={{ ...inputStyle, padding: '0 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-gray-200)', fontFamily: 'var(--font-system)', width: '100%' }}
              >
                <option value="service">Service</option>
                <option value="kitchen">Kitchen</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="button primary" onClick={handleSaveUser} disabled={!userForm.username || (!editingUser && !userForm.pin)} style={{ fontSize: '14px', height: '36px' }}>
                {editingUser ? 'Update' : 'Add'}
              </button>
              {editingUser && (
                <button className="button secondary" onClick={() => { setEditingUser(null); setUserForm({ username: '', pin: '', role: 'service' }); }} style={{ fontSize: '14px', height: '36px' }}>
                  Cancel
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
                  <button className="button secondary" onClick={() => handleEditUser(u)} style={smallBtn()}>Edit</button>
                  <button className="button secondary" onClick={() => handleDeleteUser(u.id)} style={smallBtn('var(--color-error)')}>Delete</button>
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
              <option value="">All Events</option>
              <option value="order">Orders</option>
              <option value="payment">Payments</option>
              <option value="cash_session">Cash Sessions</option>
            </select>
            <span style={{ color: 'var(--color-secondary)', fontSize: '13px' }}>{auditTotal} events</span>
          </div>

          <div style={{ display: 'grid', gap: '8px' }}>
            {auditEvents.length === 0 && (
              <p style={{ textAlign: 'center', color: 'var(--color-secondary)', marginTop: '40px' }}>No audit events</p>
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
              <p style={{ color: 'var(--color-secondary)', fontSize: '16px' }}>No scores yet today</p>
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
                      {staff.orders_served} orders | CHF {parseFloat(staff.tips_earned).toFixed(2)} tips
                    </span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '24px', fontWeight: '700' }}>{staff.points}</span>
                    <p style={{ margin: 0, fontSize: '11px', color: 'var(--color-secondary)' }}>points</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
