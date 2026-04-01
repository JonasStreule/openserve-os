import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { useWebSocket } from '../services/useWebSocket';

interface Order {
  id: string;
  table_number: string;
  status: string;
  total_amount: string;
  payment_status: string;
  tip_amount: string;
  created_at: string;
  updated_at: string;
}

interface CashSession {
  id: string;
  opening_amount: string;
  closing_amount: string | null;
  status: string;
  opened_at: string;
}

type ServiceTab = 'orders' | 'cash' | 'payments';

export function ServiceUI() {
  const [tab, setTab] = useState<ServiceTab>('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [cashSession, setCashSession] = useState<CashSession | null>(null);
  const [cashTotal, setCashTotal] = useState(0);
  const [cashBreakdown, setCashBreakdown] = useState<any[]>([]);
  const [openingAmount, setOpeningAmount] = useState('');
  const [closingAmount, setClosingAmount] = useState('');
  const [payModal, setPayModal] = useState<Order | null>(null);
  const [payMethod, setPayMethod] = useState<'cash' | 'card' | 'twint'>('card');
  const [tipAmount, setTipAmount] = useState('');

  const { lastMessage, connected } = useWebSocket('service');

  const fetchOrders = useCallback(async () => {
    const data = await api.getOrders();
    setOrders(data.orders || []);
  }, []);

  const fetchCash = useCallback(async () => {
    const data = await api.getCashCurrent();
    setCashSession(data.session);
    setCashTotal(data.current_total || 0);
    setCashBreakdown(data.breakdown || []);
  }, []);

  useEffect(() => {
    fetchOrders();
    fetchCash();
  }, [fetchOrders, fetchCash]);

  // React to WebSocket messages
  useEffect(() => {
    if (lastMessage) {
      fetchOrders();
      if (lastMessage.event === 'payment:completed') {
        fetchCash();
      }
    }
  }, [lastMessage, fetchOrders, fetchCash]);

  // Auto-refresh orders every 5s as fallback
  useEffect(() => {
    const interval = setInterval(fetchOrders, 5000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const handlePay = async () => {
    if (!payModal) return;
    const amount = parseFloat(payModal.total_amount);
    const tip = parseFloat(tipAmount) || 0;
    await api.payOrder(payModal.id, {
      amount: amount + tip,
      method: payMethod,
      tip,
      idempotency_key: `pay-${payModal.id}-${Date.now()}`,
    });
    setPayModal(null);
    setTipAmount('');
    fetchOrders();
    fetchCash();
  };

  const handleCancel = async (id: string) => {
    await api.cancelOrder(id);
    fetchOrders();
  };

  const handleOpenCash = async () => {
    await api.openCash(parseFloat(openingAmount) || 0);
    setOpeningAmount('');
    fetchCash();
  };

  const handleCloseCash = async () => {
    await api.closeCash(parseFloat(closingAmount) || 0);
    setClosingAmount('');
    fetchCash();
  };

  const activeOrders = orders.filter(o => o.status !== 'cancelled');
  const pendingPayment = activeOrders.filter(o => o.payment_status === 'unpaid' && o.status !== 'cancelled');
  const paidOrders = activeOrders.filter(o => o.payment_status === 'paid');

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

  return (
    <div style={{ padding: '16px', maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h1 style={{ margin: 0, fontSize: '24px' }}>Service</h1>
        <span style={{
          fontSize: '12px',
          color: connected ? 'var(--color-success)' : 'var(--color-error)',
        }}>
          {connected ? 'Live' : 'Offline'}
        </span>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--color-gray-200)', marginBottom: '16px' }}>
        <button style={tabStyle(tab === 'orders')} onClick={() => setTab('orders')}>
          Orders ({pendingPayment.length})
        </button>
        <button style={tabStyle(tab === 'payments')} onClick={() => setTab('payments')}>
          Paid ({paidOrders.length})
        </button>
        <button style={tabStyle(tab === 'cash')} onClick={() => setTab('cash')}>
          Cash
        </button>
      </div>

      {/* Orders Tab */}
      {tab === 'orders' && (
        <div style={{ display: 'grid', gap: '12px' }}>
          {pendingPayment.length === 0 && (
            <p style={{ textAlign: 'center', color: 'var(--color-secondary)', marginTop: '40px' }}>
              No unpaid orders
            </p>
          )}
          {pendingPayment.map(order => (
            <div key={order.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div>
                  <h3 style={{ margin: '0 0 2px 0', fontSize: '18px' }}>Table {order.table_number}</h3>
                  <span style={{ fontSize: '12px', color: 'var(--color-secondary)' }}>
                    {order.status} | {new Date(order.created_at).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <span style={{ fontSize: '20px', fontWeight: '700' }}>
                  CHF {parseFloat(order.total_amount).toFixed(2)}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <button
                  className="button primary"
                  style={{ flex: 1, fontSize: '14px' }}
                  onClick={() => { setPayModal(order); setPayMethod('card'); }}
                >
                  Pay
                </button>
                <button
                  className="button secondary"
                  style={{ fontSize: '14px', color: 'var(--color-error)' }}
                  onClick={() => handleCancel(order.id)}
                >
                  Cancel
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Paid Orders Tab */}
      {tab === 'payments' && (
        <div style={{ display: 'grid', gap: '8px' }}>
          {paidOrders.length === 0 && (
            <p style={{ textAlign: 'center', color: 'var(--color-secondary)', marginTop: '40px' }}>
              No paid orders yet
            </p>
          )}
          {paidOrders.map(order => (
            <div key={order.id} className="card" style={{ opacity: 0.8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontWeight: '600' }}>Table {order.table_number}</span>
                  <span style={{ marginLeft: '8px', fontSize: '12px', color: 'var(--color-secondary)' }}>
                    {new Date(order.updated_at).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontWeight: '600' }}>CHF {parseFloat(order.total_amount).toFixed(2)}</span>
                  {parseFloat(order.tip_amount) > 0 && (
                    <span style={{ marginLeft: '8px', fontSize: '12px', color: 'var(--color-success)' }}>
                      +{parseFloat(order.tip_amount).toFixed(2)} tip
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Cash Tab */}
      {tab === 'cash' && (
        <div>
          {!cashSession ? (
            <div className="card" style={{ textAlign: 'center', padding: '32px' }}>
              <h2 style={{ margin: '0 0 16px 0' }}>Open Cash Register</h2>
              <input
                type="number"
                placeholder="Opening amount (CHF)"
                value={openingAmount}
                onChange={e => setOpeningAmount(e.target.value)}
                style={{ width: '200px', textAlign: 'center', marginBottom: '16px' }}
              />
              <br />
              <button className="button primary" onClick={handleOpenCash} style={{ width: '200px' }}>
                Open Register
              </button>
            </div>
          ) : (
            <div>
              <div className="card" style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span style={{ color: 'var(--color-secondary)' }}>Opening</span>
                  <span style={{ fontWeight: '600' }}>CHF {parseFloat(cashSession.opening_amount).toFixed(2)}</span>
                </div>
                {cashBreakdown.map((item: any, i: number) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: 'var(--color-secondary)', textTransform: 'capitalize' }}>
                      {item.type} ({item.count}x)
                    </span>
                    <span style={{ fontWeight: '600' }}>CHF {parseFloat(item.total).toFixed(2)}</span>
                  </div>
                ))}
                <div style={{ borderTop: '1px solid var(--color-gray-200)', paddingTop: '12px', marginTop: '8px', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: '700', fontSize: '18px' }}>Total</span>
                  <span style={{ fontWeight: '700', fontSize: '18px' }}>CHF {cashTotal.toFixed(2)}</span>
                </div>
              </div>

              <div className="card" style={{ textAlign: 'center', padding: '24px' }}>
                <h3 style={{ margin: '0 0 12px 0' }}>Close Register</h3>
                <input
                  type="number"
                  placeholder="Closing amount (CHF)"
                  value={closingAmount}
                  onChange={e => setClosingAmount(e.target.value)}
                  style={{ width: '200px', textAlign: 'center', marginBottom: '12px' }}
                />
                <br />
                <button
                  className="button primary"
                  onClick={handleCloseCash}
                  style={{ width: '200px', background: 'var(--color-error)' }}
                >
                  Close Register
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Payment Modal */}
      {payModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000,
        }}
          onClick={() => setPayModal(null)}
        >
          <div className="card" style={{ width: '340px', padding: '24px' }} onClick={e => e.stopPropagation()}>
            <h2 style={{ margin: '0 0 4px 0' }}>Payment</h2>
            <p style={{ margin: '0 0 20px 0', color: 'var(--color-secondary)' }}>
              Table {payModal.table_number} — CHF {parseFloat(payModal.total_amount).toFixed(2)}
            </p>

            {/* Method Selection */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              {(['card', 'cash', 'twint'] as const).map(m => (
                <button
                  key={m}
                  className={`button ${payMethod === m ? 'primary' : 'secondary'}`}
                  onClick={() => setPayMethod(m)}
                  style={{ flex: 1, fontSize: '13px', textTransform: 'capitalize' }}
                >
                  {m}
                </button>
              ))}
            </div>

            {/* Tip */}
            <input
              type="number"
              placeholder="Tip (optional)"
              value={tipAmount}
              onChange={e => setTipAmount(e.target.value)}
              style={{ width: '100%', marginBottom: '16px' }}
            />

            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="button secondary" onClick={() => setPayModal(null)} style={{ flex: 1 }}>
                Cancel
              </button>
              <button className="button primary" onClick={handlePay} style={{ flex: 1, background: 'var(--color-success)' }}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
