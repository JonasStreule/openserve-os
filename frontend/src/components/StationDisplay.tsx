import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useWebSocket } from '../services/useWebSocket';
import { showToast } from './Toast';

interface OrderItem {
  id: string;
  product_id: string;
  name: string;
  quantity: number;
  unit_price: string;
  status: string;
  station: string;
  category: string;
}

interface Order {
  id: string;
  order_number: number;
  table_number: string;
  status: string;
  total_amount: string;
  created_at: string;
  items: OrderItem[];
}

interface StationDisplayProps {
  station: 'kitchen' | 'bar' | 'grill';
  title: string;
  emoji: string;
}

export function StationDisplay({ station, title, emoji }: StationDisplayProps) {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [gloveMode, setGloveMode] = useState(() => localStorage.getItem('glove-mode') === 'true');
  const { lastMessage, connected } = useWebSocket(station);
  const prevOrderCountRef = useRef(0);

  const toggleGloveMode = () => {
    setGloveMode(prev => {
      const next = !prev;
      localStorage.setItem('glove-mode', String(next));
      return next;
    });
  };

  // Audio ping for new orders
  const playNewOrderSound = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const freq = station === 'bar' ? 660 : station === 'grill' ? 550 : 880; // Different tone per station
      [0, 0.15].forEach(delay => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.value = 0.3;
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + 0.1);
      });
    } catch { /* Audio not available */ }
  }, [station]);

  const fetchOrders = useCallback(async () => {
    try {
      const data = await api.getOrders(station);
      const newOrders: Order[] = data.orders || [];
      setOrders(newOrders);

      const activeCount = newOrders.filter(o => o.status !== 'cancelled' && o.status !== 'delivered').length;
      if (activeCount > prevOrderCountRef.current && prevOrderCountRef.current > 0) {
        playNewOrderSound();
        showToast('Neue Bestellung eingegangen!', 'info');
      }
      prevOrderCountRef.current = activeCount;
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    }
  }, [station, playNewOrderSound]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);
  useEffect(() => { if (lastMessage) fetchOrders(); }, [lastMessage, fetchOrders]);

  // Fallback polling only when WS disconnected
  useEffect(() => {
    if (connected) return;
    const interval = setInterval(fetchOrders, 8000);
    return () => clearInterval(interval);
  }, [fetchOrders, connected]);

  const getWaitTime = (createdAt: string) => {
    const minutes = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
    return `${minutes}m`;
  };

  const getWaitColor = (createdAt: string) => {
    const minutes = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
    if (minutes >= 20) return 'var(--color-error)';
    if (minutes >= 10) return 'var(--color-warning)';
    return 'var(--color-secondary)';
  };

  const getWaitEmoji = (createdAt: string) => {
    const minutes = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
    if (minutes >= 20) return ' \uD83D\uDD25';
    if (minutes >= 10) return ' \u26A0\uFE0F';
    return '';
  };

  const updateItemStatus = async (orderId: string, itemId: string, status: string) => {
    try {
      await api.updateOrderItem(orderId, itemId, status);
      fetchOrders();
    } catch {
      showToast('Status konnte nicht aktualisiert werden', 'error');
    }
  };

  // Mark ALL items of this station in an order
  const markAllItems = async (order: Order, status: string) => {
    try {
      for (const item of order.items) {
        if (item.station === station && item.status !== 'ready' && item.status !== 'cancelled') {
          await api.updateOrderItem(order.id, item.id, status);
        }
      }
      fetchOrders();
    } catch {
      showToast('Fehler beim Aktualisieren', 'error');
    }
  };

  const getItemStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return '\u23F3';    // hourglass
      case 'preparing': return '\uD83D\uDD25'; // fire
      case 'ready': return '\u2705';      // check
      case 'cancelled': return '\u274C';  // X
      default: return '';
    }
  };

  // Only show orders with pending/preparing items for this station
  const activeOrders = orders.filter(order => {
    const stationItems = order.items.filter(i => i.station === station);
    return stationItems.some(i => i.status === 'pending' || i.status === 'preparing');
  });

  // Orders where all station items are ready (pickup section)
  const readyOrders = orders.filter(order => {
    const stationItems = order.items.filter(i => i.station === station);
    return stationItems.length > 0 && stationItems.every(i => i.status === 'ready');
  });

  return (
    <div style={{ padding: '20px', height: '100vh', overflow: 'auto', background: 'var(--color-gray-100)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '28px' }}>{emoji}</span>
          <h1 style={{ margin: 0, fontSize: '26px' }}>{title}</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ color: 'var(--color-secondary)', fontSize: '14px', fontWeight: '600' }}>
            {activeOrders.length} offen
          </span>
          {readyOrders.length > 0 && (
            <span style={{ background: 'var(--color-success)', color: 'white', padding: '4px 10px', borderRadius: '12px', fontSize: '13px', fontWeight: '600' }}>
              {readyOrders.length} abholbereit
            </span>
          )}
          <span style={{ fontSize: '12px', color: connected ? 'var(--color-success)' : 'var(--color-error)', fontWeight: '600' }}>
            {connected ? '\u25CF Live' : '\u25CB Offline'}
          </span>
          <button
            onClick={toggleGloveMode}
            title={gloveMode ? 'Handschuh-Modus aus' : 'Handschuh-Modus an'}
            style={{
              background: gloveMode ? 'var(--color-primary)' : 'var(--color-gray-200)',
              border: 'none', borderRadius: '8px', cursor: 'pointer',
              fontSize: '20px', width: '40px', height: '40px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            🧤
          </button>
          <button className="button secondary" onClick={() => { localStorage.removeItem('token'); localStorage.removeItem('user'); navigate('/login'); }}
            style={{ fontSize: gloveMode ? '16px' : '12px', height: gloveMode ? '48px' : '32px', color: 'var(--color-error)' }}>
            Abmelden
          </button>
        </div>
      </div>

      {/* Active Orders Grid */}
      {activeOrders.length > 0 && (
        <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', marginBottom: '24px' }}>
          {activeOrders.map(order => {
            const stationItems = order.items.filter(i => i.station === station);
            const allPending = stationItems.every(i => i.status === 'pending');
            const allPreparing = stationItems.some(i => i.status === 'preparing');

            return (
              <div key={order.id} className="card" style={{ background: 'white', padding: gloveMode ? '24px' : undefined }}>
                {/* Order header with BIG number */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                    <span style={{
                      fontSize: '32px', fontWeight: '800', color: 'var(--color-primary)',
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      #{String(order.order_number || 0).padStart(3, '0')}
                    </span>
                    <span style={{ fontSize: '15px', color: 'var(--color-secondary)' }}>
                      Tisch {order.table_number}
                    </span>
                  </div>
                  <span style={{
                    color: getWaitColor(order.created_at),
                    fontSize: '13px',
                    fontWeight: getWaitColor(order.created_at) !== 'var(--color-secondary)' ? '700' : '400',
                  }}>
                    {getWaitTime(order.created_at)}{getWaitEmoji(order.created_at)}
                  </span>
                </div>

                {/* Items with individual controls */}
                <div style={{ marginBottom: '12px', borderTop: '1px solid var(--color-gray-200)', paddingTop: '10px' }}>
                  {stationItems.map(item => (
                    <div key={item.id} style={{
                      display: gloveMode ? 'block' : 'flex', alignItems: gloveMode ? undefined : 'center', gap: gloveMode ? undefined : '8px',
                      padding: gloveMode ? '20px 0' : '6px 0',
                      borderBottom: '1px solid var(--color-gray-100)',
                      opacity: item.status === 'ready' ? 0.5 : 1,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: gloveMode ? '12px' : '8px' }}>
                        <span style={{ fontSize: gloveMode ? '22px' : '14px' }}>{getItemStatusIcon(item.status)}</span>
                        <span style={{ fontWeight: '700', fontSize: gloveMode ? '24px' : '16px', minWidth: '28px' }}>{item.quantity}×</span>
                        <span style={{
                          flex: 1, fontSize: gloveMode ? '22px' : '15px',
                          textDecoration: item.status === 'ready' ? 'line-through' : 'none',
                        }}>
                          {item.name || 'Item'}
                        </span>
                        {/* Inline button when NOT in glove mode */}
                        {!gloveMode && item.status === 'pending' && (
                          <button
                            onClick={() => updateItemStatus(order.id, item.id, 'preparing')}
                            style={{
                              background: 'var(--color-info)', color: 'white', border: 'none',
                              borderRadius: '6px', padding: '4px 10px', fontSize: '12px',
                              fontWeight: '600', cursor: 'pointer', fontFamily: 'var(--font-system)',
                            }}
                          >
                            Start
                          </button>
                        )}
                        {!gloveMode && item.status === 'preparing' && (
                          <button
                            onClick={() => updateItemStatus(order.id, item.id, 'ready')}
                            style={{
                              background: 'var(--color-success)', color: 'white', border: 'none',
                              borderRadius: '6px', padding: '4px 10px', fontSize: '12px',
                              fontWeight: '600', cursor: 'pointer', fontFamily: 'var(--font-system)',
                            }}
                          >
                            Fertig
                          </button>
                        )}
                        {!gloveMode && item.status === 'ready' && (
                          <span style={{ fontSize: '12px', color: 'var(--color-success)', fontWeight: '600' }}>
                            Bereit
                          </span>
                        )}
                      </div>

                      {/* Full-width button when in glove mode */}
                      {gloveMode && item.status === 'pending' && (
                        <button
                          onClick={() => updateItemStatus(order.id, item.id, 'preparing')}
                          style={{
                            background: 'var(--color-info)', color: 'white', border: 'none',
                            borderRadius: '8px', padding: '0 16px', fontSize: '24px',
                            fontWeight: '600', cursor: 'pointer', fontFamily: 'var(--font-system)',
                            width: '100%', minHeight: '80px', marginTop: '10px',
                          }}
                        >
                          Start
                        </button>
                      )}
                      {gloveMode && item.status === 'preparing' && (
                        <button
                          onClick={() => updateItemStatus(order.id, item.id, 'ready')}
                          style={{
                            background: 'var(--color-success)', color: 'white', border: 'none',
                            borderRadius: '8px', padding: '0 16px', fontSize: '24px',
                            fontWeight: '600', cursor: 'pointer', fontFamily: 'var(--font-system)',
                            width: '100%', minHeight: '80px', marginTop: '10px',
                          }}
                        >
                          Fertig
                        </button>
                      )}
                      {gloveMode && item.status === 'ready' && (
                        <span style={{ fontSize: '18px', color: 'var(--color-success)', fontWeight: '600', display: 'block', marginTop: '8px' }}>
                          Bereit
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Bulk action buttons */}
                <div style={{ display: 'flex', gap: gloveMode ? '12px' : '8px', flexDirection: gloveMode ? 'column' : 'row' }}>
                  {allPending && (
                    <button
                      className="button primary"
                      onClick={() => markAllItems(order, 'preparing')}
                      style={{ flex: 1, fontSize: gloveMode ? '24px' : '14px', minHeight: gloveMode ? '80px' : '42px', height: gloveMode ? 'auto' : '42px' }}
                    >
                      Alle starten
                    </button>
                  )}
                  {allPreparing && (
                    <button
                      className="button primary"
                      onClick={() => markAllItems(order, 'ready')}
                      style={{ flex: 1, fontSize: gloveMode ? '24px' : '14px', minHeight: gloveMode ? '80px' : '42px', height: gloveMode ? 'auto' : '42px', background: 'var(--color-success)' }}
                    >
                      Alle fertig
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Ready for Pickup Section */}
      {readyOrders.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '18px', color: 'var(--color-success)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>✅</span> Abholbereit
          </h2>
          <div style={{ display: 'grid', gap: '8px', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            {readyOrders.map(order => (
              <div key={order.id} style={{
                background: '#d1fae5', border: '2px solid var(--color-success)',
                borderRadius: '12px', padding: '14px', textAlign: 'center',
              }}>
                <span style={{ fontSize: '28px', fontWeight: '800', display: 'block' }}>
                  #{String(order.order_number || 0).padStart(3, '0')}
                </span>
                <span style={{ fontSize: '14px', color: '#065f46' }}>
                  Tisch {order.table_number}
                </span>
                <div style={{ marginTop: '6px', fontSize: '12px', color: '#065f46' }}>
                  {order.items.filter(i => i.station === station).map(i => `${i.quantity}× ${i.name}`).join(', ')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {activeOrders.length === 0 && readyOrders.length === 0 && (
        <div style={{ textAlign: 'center', marginTop: '80px' }}>
          <p style={{ fontSize: '48px', marginBottom: '16px' }}>{emoji}</p>
          <p style={{ fontSize: '20px', fontWeight: '600', marginBottom: '8px' }}>Alles erledigt!</p>
          <p style={{ color: 'var(--color-secondary)', fontSize: '15px' }}>
            Keine offenen Bestellungen. Neue Bestellungen erscheinen hier automatisch.
          </p>
        </div>
      )}
    </div>
  );
}
