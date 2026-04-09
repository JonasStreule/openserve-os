import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useWebSocket } from '../services/useWebSocket';
import { showToast } from './Toast';

interface Order {
  id: string;
  order_number: number;
  table_number: string;
  status: string;
  total_amount: string;
  items: Array<{
    id: string;
    name?: string;
    quantity: number;
    status: string;
    station?: string;
    product_id?: string;
  }>;
  created_at: string;
}

export function RunnerDisplay() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const { lastMessage, connected } = useWebSocket('service');
  const prevReadyCountRef = useRef(0);

  // Audio ping for new ready orders
  const playReadySound = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      [0, 0.12, 0.24].forEach(delay => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 1000;
        osc.type = 'sine';
        gain.gain.value = 0.25;
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + 0.08);
      });
    } catch { /* Audio not available */ }
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      const data = await api.getOrders();
      const allOrders: Order[] = data.orders || [];
      // Only keep orders that are ready or preparing
      const relevant = allOrders.filter(o => o.status === 'ready' || o.status === 'preparing');
      setOrders(relevant);

      const readyCount = relevant.filter(o => o.status === 'ready').length;
      if (readyCount > prevReadyCountRef.current && prevReadyCountRef.current >= 0) {
        playReadySound();
      }
      prevReadyCountRef.current = readyCount;
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    }
  }, [playReadySound]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);
  useEffect(() => { if (lastMessage) fetchOrders(); }, [lastMessage, fetchOrders]);

  // Auto-refresh every 10 seconds as backup
  useEffect(() => {
    const interval = setInterval(fetchOrders, 10000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const markServed = async (orderId: string) => {
    try {
      await api.updateOrder(orderId, 'served');
      setConfirmingId(null);
      showToast('Bestellung serviert!', 'success');
      fetchOrders();
    } catch {
      showToast('Fehler beim Aktualisieren', 'error');
    }
  };

  const handleTap = (orderId: string) => {
    if (confirmingId === orderId) {
      markServed(orderId);
    } else {
      setConfirmingId(orderId);
    }
  };

  const getWaitTime = (createdAt: string) => {
    const minutes = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
    return `${minutes}m`;
  };

  const getItemSummary = (items: Order['items']) => {
    if (!items || !Array.isArray(items)) return '';
    return items
      .filter(i => i.status !== 'cancelled')
      .map(i => `${i.quantity}× ${i.name || 'Item'}`)
      .join(', ');
  };

  const readyOrders = orders.filter(o => o.status === 'ready');
  const preparingOrders = orders.filter(o => o.status === 'preparing');

  return (
    <div style={{ padding: '16px', height: '100vh', overflow: 'auto', background: 'var(--color-gray-100)' }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '16px', flexWrap: 'wrap', gap: '8px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '28px' }}>{'\uD83C\uDFC3'}</span>
          <h1 style={{ margin: 0, fontSize: '24px' }}>Runner</h1>
          {readyOrders.length > 0 && (
            <span style={{
              background: 'var(--color-success)', color: 'white',
              padding: '4px 12px', borderRadius: '14px',
              fontSize: '15px', fontWeight: '700',
            }}>
              {readyOrders.length} bereit
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{
            fontSize: '12px', fontWeight: '600',
            color: connected ? 'var(--color-success)' : 'var(--color-error)',
          }}>
            {connected ? '\u25CF Live' : '\u25CB Offline'}
          </span>
          <button
            className="button secondary"
            onClick={() => { localStorage.removeItem('token'); localStorage.removeItem('user'); navigate('/login'); }}
            style={{ fontSize: '12px', height: '32px', color: 'var(--color-error)' }}
          >
            Abmelden
          </button>
        </div>
      </div>

      {/* Ready Orders — prominent */}
      {readyOrders.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{
            fontSize: '16px', color: 'var(--color-success)', marginBottom: '10px',
            textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '700',
          }}>
            Jetzt servieren
          </h2>
          <div style={{
            display: 'grid', gap: '12px',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          }}>
            {readyOrders.map(order => (
              <div
                key={order.id}
                onClick={() => handleTap(order.id)}
                style={{
                  background: confirmingId === order.id ? '#065f46' : '#d1fae5',
                  border: '3px solid var(--color-success)',
                  borderRadius: '14px',
                  padding: '16px',
                  cursor: 'pointer',
                  minHeight: '60px',
                  transition: 'background 0.2s, transform 0.1s',
                  userSelect: 'none',
                  position: 'relative',
                }}
              >
                {/* Top row: order number + table */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                  marginBottom: '8px',
                }}>
                  <span style={{
                    fontSize: '22px', fontWeight: '700',
                    color: confirmingId === order.id ? '#d1fae5' : '#065f46',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    #{String(order.order_number || 0).padStart(3, '0')}
                  </span>
                  <span style={{
                    fontSize: '12px', fontWeight: '600',
                    color: confirmingId === order.id ? '#a7f3d0' : '#065f46',
                  }}>
                    {getWaitTime(order.created_at)}
                  </span>
                </div>

                {/* BIG table number */}
                <div style={{
                  fontSize: '42px', fontWeight: '900', textAlign: 'center',
                  color: confirmingId === order.id ? 'white' : '#065f46',
                  lineHeight: 1.1, margin: '4px 0 10px',
                }}>
                  Tisch {order.table_number}
                </div>

                {/* Item summary */}
                <div style={{
                  fontSize: '14px', textAlign: 'center',
                  color: confirmingId === order.id ? '#a7f3d0' : '#047857',
                  lineHeight: 1.4,
                }}>
                  {getItemSummary(order.items)}
                </div>

                {/* Confirm overlay */}
                {confirmingId === order.id && (
                  <div style={{
                    marginTop: '12px', textAlign: 'center',
                  }}>
                    <span style={{
                      display: 'inline-block',
                      background: 'white', color: '#065f46',
                      padding: '8px 24px', borderRadius: '8px',
                      fontSize: '16px', fontWeight: '700',
                    }}>
                      Serviert? Nochmal tippen
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmingId(null); }}
                      style={{
                        display: 'block', margin: '8px auto 0',
                        background: 'transparent', border: 'none',
                        color: '#a7f3d0', fontSize: '13px', cursor: 'pointer',
                        fontFamily: 'var(--font-system)',
                      }}
                    >
                      Abbrechen
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preparing Orders — secondary */}
      {preparingOrders.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{
            fontSize: '14px', color: 'var(--color-warning)', marginBottom: '10px',
            textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '700',
          }}>
            In Zubereitung ({preparingOrders.length})
          </h2>
          <div style={{
            display: 'grid', gap: '10px',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          }}>
            {preparingOrders.map(order => (
              <div
                key={order.id}
                className="card"
                style={{
                  background: '#fffbeb',
                  border: '2px solid var(--color-warning)',
                  opacity: 0.85,
                }}
              >
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                  marginBottom: '6px',
                }}>
                  <span style={{
                    fontSize: '18px', fontWeight: '700', color: 'var(--color-warning)',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    #{String(order.order_number || 0).padStart(3, '0')}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--color-secondary)' }}>
                    {getWaitTime(order.created_at)}
                  </span>
                </div>
                <div style={{
                  fontSize: '28px', fontWeight: '800', textAlign: 'center',
                  color: '#92400e', margin: '2px 0 8px',
                }}>
                  Tisch {order.table_number}
                </div>
                <div style={{
                  fontSize: '13px', textAlign: 'center', color: '#92400e',
                  lineHeight: 1.4,
                }}>
                  {getItemSummary(order.items)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {readyOrders.length === 0 && preparingOrders.length === 0 && (
        <div style={{ textAlign: 'center', marginTop: '100px' }}>
          <p style={{ fontSize: '56px', marginBottom: '16px' }}>{'\uD83C\uDFC3'}</p>
          <p style={{ fontSize: '22px', fontWeight: '600', marginBottom: '8px' }}>Keine Bestellungen</p>
          <p style={{ color: 'var(--color-secondary)', fontSize: '15px' }}>
            Fertige Bestellungen erscheinen hier automatisch.
          </p>
        </div>
      )}
    </div>
  );
}
