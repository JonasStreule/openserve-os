import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { useWebSocket } from '../services/useWebSocket';

interface Order {
  id: string;
  table_number: string;
  status: string;
  total_amount: string;
  created_at: string;
}

export function KitchenDisplay() {
  const [orders, setOrders] = useState<Order[]>([]);
  const { lastMessage, connected } = useWebSocket('kitchen');

  const fetchOrders = useCallback(async () => {
    try {
      const data = await api.getOrders();
      setOrders(data.orders || []);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // React to WebSocket updates
  useEffect(() => {
    if (lastMessage) fetchOrders();
  }, [lastMessage, fetchOrders]);

  // Fallback polling every 5s
  useEffect(() => {
    const interval = setInterval(fetchOrders, 5000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const getWaitTime = (createdAt: string) => {
    const minutes = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
    return `${minutes}m`;
  };

  const updateStatus = async (orderId: string, status: string) => {
    await api.updateOrder(orderId, status);
    fetchOrders();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'var(--color-warning)';
      case 'preparing': return 'var(--color-info)';
      case 'ready': return 'var(--color-success)';
      default: return 'var(--color-secondary)';
    }
  };

  const activeOrders = orders.filter(o => o.status === 'pending' || o.status === 'preparing');

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ margin: 0, fontSize: '28px' }}>Kitchen Queue</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ color: 'var(--color-secondary)', fontSize: '14px' }}>
            {activeOrders.length} active
          </span>
          <span style={{
            fontSize: '12px',
            color: connected ? 'var(--color-success)' : 'var(--color-error)',
          }}>
            {connected ? 'Live' : 'Offline'}
          </span>
        </div>
      </div>

      {!navigator.onLine && (
        <div style={{
          background: 'var(--color-warning)',
          color: 'white',
          padding: '12px',
          borderRadius: 'var(--radius-md)',
          marginBottom: '16px',
          fontWeight: '600',
        }}>
          Offline Mode - Will sync when back online
        </div>
      )}

      <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        {activeOrders.map(order => (
          <div key={order.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div>
                <h2 style={{ margin: '0 0 4px 0', fontSize: '24px' }}>
                  Table {order.table_number}
                </h2>
                <p style={{ margin: 0, color: 'var(--color-secondary)', fontSize: '13px' }}>
                  Waiting: {getWaitTime(order.created_at)} | CHF {parseFloat(order.total_amount).toFixed(2)}
                </p>
              </div>
              <span style={{
                background: getStatusColor(order.status),
                color: 'white',
                padding: '4px 10px',
                borderRadius: 'var(--radius-md)',
                fontSize: '12px',
                fontWeight: '600',
                textTransform: 'uppercase',
              }}>
                {order.status}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              {order.status === 'pending' && (
                <button
                  className="button primary"
                  onClick={() => updateStatus(order.id, 'preparing')}
                  style={{ flex: 1, fontSize: '14px' }}
                >
                  Start Cooking
                </button>
              )}
              {order.status === 'preparing' && (
                <button
                  className="button primary"
                  onClick={() => updateStatus(order.id, 'ready')}
                  style={{ flex: 1, fontSize: '14px', background: 'var(--color-success)' }}
                >
                  Ready to Serve
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {activeOrders.length === 0 && (
        <p style={{ textAlign: 'center', color: 'var(--color-secondary)', marginTop: '60px', fontSize: '18px' }}>
          No orders pending
        </p>
      )}
    </div>
  );
}
