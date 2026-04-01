import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

type AdminTab = 'dashboard' | 'audit' | 'leaderboard';

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

export function AdminDashboard() {
  const [tab, setTab] = useState<AdminTab>('dashboard');
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditFilter, setAuditFilter] = useState('');
  const [leaderboard, setLeaderboard] = useState<StaffScore[]>([]);

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

  useEffect(() => {
    fetchMetrics();
    fetchLeaderboard();
  }, [fetchMetrics, fetchLeaderboard]);

  useEffect(() => { fetchAudit(); }, [fetchAudit]);

  // Auto-refresh metrics
  useEffect(() => {
    const interval = setInterval(fetchMetrics, 10000);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  const tabStyle = (active: boolean) => ({
    flex: 1,
    padding: '10px',
    border: 'none',
    borderBottom: active ? '2px solid var(--color-black)' : '2px solid transparent',
    background: 'transparent',
    color: active ? 'var(--color-primary)' : 'var(--color-secondary)',
    fontFamily: 'var(--font-system)',
    fontSize: '14px',
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

  return (
    <div style={{ padding: '16px', maxWidth: '900px', margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 16px 0', fontSize: '24px' }}>Admin</h1>

      <div style={{ display: 'flex', borderBottom: '1px solid var(--color-gray-200)', marginBottom: '16px' }}>
        <button style={tabStyle(tab === 'dashboard')} onClick={() => setTab('dashboard')}>Dashboard</button>
        <button style={tabStyle(tab === 'audit')} onClick={() => setTab('audit')}>Audit Log</button>
        <button style={tabStyle(tab === 'leaderboard')} onClick={() => setTab('leaderboard')}>Leaderboard</button>
      </div>

      {/* Dashboard Tab */}
      {tab === 'dashboard' && metrics && (
        <div>
          {/* Key Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '20px' }}>
            {statCard('Revenue', `CHF ${metrics.revenue.total.toFixed(2)}`)}
            {statCard('Orders', `${metrics.orders.total}`)}
            {statCard('Avg. Order', `CHF ${metrics.revenue.average_order.toFixed(2)}`)}
            {statCard('Tips', `CHF ${metrics.revenue.tips.toFixed(2)}`, undefined, 'var(--color-success)')}
          </div>

          {/* Orders by Status */}
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

          {/* Payment Methods */}
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

          {/* Weekly Trend */}
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

      {/* Audit Log Tab */}
      {tab === 'audit' && (
        <div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'center' }}>
            <select
              value={auditFilter}
              onChange={e => setAuditFilter(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-gray-200)',
                fontFamily: 'var(--font-system)',
                fontSize: '14px',
              }}
            >
              <option value="">All Events</option>
              <option value="order">Orders</option>
              <option value="payment">Payments</option>
              <option value="cash_session">Cash Sessions</option>
            </select>
            <span style={{ color: 'var(--color-secondary)', fontSize: '13px' }}>
              {auditTotal} events
            </span>
          </div>

          <div style={{ display: 'grid', gap: '8px' }}>
            {auditEvents.length === 0 && (
              <p style={{ textAlign: 'center', color: 'var(--color-secondary)', marginTop: '40px' }}>No audit events</p>
            )}
            {auditEvents.map(event => (
              <div key={event.id} className="card" style={{ padding: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: '600',
                      textTransform: 'uppercase',
                      color: 'var(--color-info)',
                      letterSpacing: '0.5px',
                    }}>
                      {event.entity_type}
                    </span>
                    <p style={{ margin: '4px 0 0 0', fontSize: '14px', fontWeight: '500' }}>
                      {event.event_type}
                    </p>
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--color-secondary)' }}>
                    {new Date(event.created_at).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                {(event.new_value || event.old_value) && (
                  <pre style={{
                    margin: '8px 0 0 0',
                    padding: '8px',
                    background: 'var(--color-gray-100)',
                    borderRadius: '4px',
                    fontSize: '11px',
                    overflow: 'auto',
                    maxHeight: '80px',
                  }}>
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
              <p style={{ color: 'var(--color-tertiary)', fontSize: '13px' }}>Scores are tracked when staff complete orders</p>
            </div>
          )}
          <div style={{ display: 'grid', gap: '8px' }}>
            {leaderboard.map((staff, index) => (
              <div key={staff.id} className="card" style={{
                padding: '16px',
                border: index < 3 ? '2px solid var(--color-warning)' : undefined,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '24px', minWidth: '40px', textAlign: 'center' }}>
                    {getMedal(index)}
                  </span>
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
