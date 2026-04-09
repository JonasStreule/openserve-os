import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useWebSocket } from '../services/useWebSocket';
import { generateCashReport } from '../utils/cashReport';
import { ConfirmModal } from './ConfirmModal';
import { showToast } from './Toast';

interface Order {
  id: string;
  order_number: number;
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
  const navigate = useNavigate();
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
  const [confirmAction, setConfirmAction] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

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

  // Fallback polling only when WebSocket is disconnected
  useEffect(() => {
    if (connected) return; // WebSocket is live — no need to poll
    const interval = setInterval(fetchOrders, 8000);
    return () => clearInterval(interval);
  }, [fetchOrders, connected]);

  const handlePay = async () => {
    if (!payModal) return;
    try {
      const orderTotal = parseFloat(payModal.total_amount);
      const received = parseFloat(tipAmount) || orderTotal;
      const tip = received > orderTotal ? received - orderTotal : 0;
      await api.payOrder(payModal.id, {
        amount: orderTotal + tip,
        method: payMethod,
        tip,
        idempotency_key: `pay-${payModal.id}-${Date.now()}`,
      });
      setPayModal(null);
      setTipAmount('');
      showToast('Zahlung erfolgreich verbucht', 'success');
      fetchOrders();
      fetchCash();
    } catch {
      showToast('Zahlung fehlgeschlagen', 'error');
    }
  };

  const handleCancel = (id: string) => {
    setConfirmAction({
      title: 'Bestellung stornieren',
      message: 'Diese Bestellung wird unwiderruflich storniert. Wirklich fortfahren?',
      onConfirm: async () => {
        try {
          await api.cancelOrder(id);
          setConfirmAction(null);
          showToast('Bestellung storniert', 'error');
          fetchOrders();
        } catch {
          setConfirmAction(null);
          showToast('Stornierung fehlgeschlagen', 'error');
        }
      },
    });
  };

  const handleOpenCash = async () => {
    try {
      await api.openCash(parseFloat(openingAmount) || 0);
      setOpeningAmount('');
      fetchCash();
    } catch {
      showToast('Kasse konnte nicht geöffnet werden', 'error');
    }
  };

  const handleCloseCashConfirm = () => {
    if (!closingAmount) {
      showToast('Bitte Schlussbestand eingeben', 'error');
      return;
    }
    setConfirmAction({
      title: 'Kasse schliessen',
      message: 'Die Kasse wird geschlossen und der Tagesabschluss erstellt. Dies kann nicht rückgängig gemacht werden.',
      onConfirm: () => { setConfirmAction(null); handleCloseCash(); },
    });
  };

  const handleCloseCash = async () => {
    const closingVal = parseFloat(closingAmount) || 0;
    const openingVal = cashSession ? parseFloat(cashSession.opening_amount) : 0;

    // Collect report data before closing
    const cashPayments = cashBreakdown
      .filter((item: any) => item.type === 'cash')
      .reduce((sum: number, item: any) => sum + parseFloat(item.total), 0);
    const expectedAmount = openingVal + cashPayments;
    const totalOrders = cashBreakdown.reduce((sum: number, item: any) => sum + (item.count || 0), 0);
    const totalRevenue = cashBreakdown.reduce((sum: number, item: any) => sum + parseFloat(item.total), 0);

    const now = new Date();
    const reportData = {
      date: now.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      openedAt: cashSession
        ? new Date(cashSession.opened_at).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })
        : '--:--',
      closedAt: now.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' }),
      openingAmount: openingVal,
      closingAmount: closingVal,
      expectedAmount,
      difference: closingVal - expectedAmount,
      breakdown: cashBreakdown.map((item: any) => ({
        type: item.type,
        count: item.count || 0,
        total: parseFloat(item.total) || 0,
      })),
      totalRevenue,
      totalOrders,
      totalTips: 0, // tips not tracked separately in current breakdown
    };

    try {
      await api.closeCash(closingVal);
      // Generate printable report before clearing state
      generateCashReport(reportData);
      setClosingAmount('');
      showToast('Kasse geschlossen — Tagesabschluss erstellt', 'success');
      fetchCash();
    } catch {
      showToast('Kasse konnte nicht geschlossen werden', 'error');
    }
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="button secondary" onClick={() => navigate('/tasks')}
            style={{ fontSize: '12px', height: '32px' }}>
            📋 Aufgaben
          </button>
          <span style={{ fontSize: '12px', color: connected ? 'var(--color-success)' : 'var(--color-error)' }}>
            {connected ? 'Live' : 'Offline'}
          </span>
          <button className="button secondary" onClick={() => { localStorage.removeItem('token'); localStorage.removeItem('user'); navigate('/login'); }}
            style={{ fontSize: '12px', height: '32px', color: 'var(--color-error)' }}>
            Abmelden
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--color-gray-200)', marginBottom: '16px' }}>
        <button style={tabStyle(tab === 'orders')} onClick={() => setTab('orders')}>
          Bestellungen ({pendingPayment.length})
        </button>
        <button style={tabStyle(tab === 'payments')} onClick={() => setTab('payments')}>
          Bezahlt ({paidOrders.length})
        </button>
        <button style={tabStyle(tab === 'cash')} onClick={() => setTab('cash')}>
          Kasse
        </button>
      </div>

      {/* Orders Tab */}
      {tab === 'orders' && (
        <div style={{ display: 'grid', gap: '12px' }}>
          {pendingPayment.length === 0 && (
            <p style={{ textAlign: 'center', color: 'var(--color-secondary)', marginTop: '40px' }}>
              Keine offenen Bestellungen
            </p>
          )}
          {pendingPayment.map(order => (
            <div key={order.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <span style={{ fontSize: '20px', fontWeight: '800', fontVariantNumeric: 'tabular-nums' }}>
                      #{String(order.order_number || 0).padStart(3, '0')}
                    </span>
                    <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--color-secondary)' }}>Tisch {order.table_number}</h3>
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--color-secondary)' }}>
                    {order.status === 'pending' ? 'offen' : order.status === 'preparing' ? 'in Zubereitung' : order.status === 'ready' ? 'fertig' : order.status === 'delivered' ? 'serviert' : order.status} | {new Date(order.created_at).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}
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
                  Bezahlen
                </button>
                <button
                  className="button secondary"
                  style={{ fontSize: '14px', color: 'var(--color-error)' }}
                  onClick={() => handleCancel(order.id)}
                >
                  Stornieren
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
              Noch keine bezahlten Bestellungen
            </p>
          )}
          {paidOrders.map(order => (
            <div key={order.id} className="card" style={{ opacity: 0.8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontWeight: '600' }}>Tisch {order.table_number}</span>
                  <span style={{ marginLeft: '8px', fontSize: '12px', color: 'var(--color-secondary)' }}>
                    {new Date(order.updated_at).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontWeight: '600' }}>CHF {parseFloat(order.total_amount).toFixed(2)}</span>
                  {parseFloat(order.tip_amount) > 0 && (
                    <span style={{ marginLeft: '8px', fontSize: '12px', color: 'var(--color-success)' }}>
                      +{parseFloat(order.tip_amount).toFixed(2)} Trinkgeld
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
              <h2 style={{ margin: '0 0 16px 0' }}>Kasse öffnen</h2>
              <input
                type="number"
                placeholder="Anfangsbestand (CHF)"
                value={openingAmount}
                onChange={e => setOpeningAmount(e.target.value)}
                style={{ width: '200px', textAlign: 'center', marginBottom: '16px' }}
              />
              <br />
              <button className="button primary" onClick={handleOpenCash} style={{ width: '200px' }}>
                Kasse öffnen
              </button>
            </div>
          ) : (
            <div>
              <div className="card" style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span style={{ color: 'var(--color-secondary)' }}>Anfangsbestand</span>
                  <span style={{ fontWeight: '600' }}>CHF {parseFloat(cashSession.opening_amount).toFixed(2)}</span>
                </div>
                {cashBreakdown.map((item: any, i: number) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: 'var(--color-secondary)', textTransform: 'capitalize' }}>
                      {item.type === 'cash' ? 'Bar' : item.type === 'card' ? 'Karte' : item.type} ({item.count}x)
                    </span>
                    <span style={{ fontWeight: '600' }}>CHF {parseFloat(item.total).toFixed(2)}</span>
                  </div>
                ))}
                <div style={{ borderTop: '1px solid var(--color-gray-200)', paddingTop: '12px', marginTop: '8px', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: '700', fontSize: '18px' }}>Gesamt</span>
                  <span style={{ fontWeight: '700', fontSize: '18px' }}>CHF {cashTotal.toFixed(2)}</span>
                </div>
              </div>

              <div className="card" style={{ textAlign: 'center', padding: '24px' }}>
                <h3 style={{ margin: '0 0 12px 0' }}>Kasse schliessen</h3>
                <input
                  type="number"
                  placeholder="Schlussbestand (CHF)"
                  value={closingAmount}
                  onChange={e => setClosingAmount(e.target.value)}
                  style={{ width: '200px', textAlign: 'center', marginBottom: '12px' }}
                />
                <br />
                <button
                  className="button primary"
                  onClick={handleCloseCashConfirm}
                  style={{ width: '200px', background: 'var(--color-error)' }}
                >
                  Kasse schliessen
                </button>
                <p style={{ marginTop: '8px', fontSize: '12px', color: 'var(--color-secondary)' }}>
                  Tagesabschluss wird automatisch erstellt
                </p>
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
            <h2 style={{ margin: '0 0 16px 0' }}>Bezahlung</h2>

            {/* Order total prominently */}
            <div style={{ textAlign: 'center', marginBottom: '20px', padding: '12px', background: 'var(--color-gray-100, #f5f5f5)', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: 'var(--color-secondary)', marginBottom: '4px' }}>Tisch {payModal.table_number}</div>
              <div style={{ fontSize: '28px', fontWeight: '700' }}>CHF {parseFloat(payModal.total_amount).toFixed(2)}</div>
            </div>

            {/* Method Selection */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              {(['card', 'cash', 'twint'] as const).map(m => {
                const label = m === 'card' ? 'Karte' : m === 'cash' ? 'Bar' : 'Twint';
                return (
                  <button
                    key={m}
                    className={`button ${payMethod === m ? 'primary' : 'secondary'}`}
                    onClick={() => setPayMethod(m)}
                    style={{ flex: 1, fontSize: '13px' }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Received amount — "mach 40" style */}
            <div style={{ fontSize: '13px', color: 'var(--color-secondary)', marginBottom: '2px' }}>Erhalten vom Gast (Gesamtbetrag)</div>
            <div style={{ fontSize: '11px', color: 'var(--color-secondary)', marginBottom: '6px' }}>Trinkgeld wird automatisch berechnet</div>
            <input
              type="number"
              placeholder={parseFloat(payModal.total_amount).toFixed(2)}
              value={tipAmount}
              onChange={e => setTipAmount(e.target.value)}
              style={{ width: '100%', marginBottom: '4px', fontSize: '18px', textAlign: 'center', height: '48px' }}
            />
            {(() => {
              const received = parseFloat(tipAmount) || 0;
              const total = parseFloat(payModal.total_amount);
              const tip = received > total ? received - total : 0;
              return received > 0 && tip > 0 ? (
                <p style={{ margin: '0 0 12px 0', textAlign: 'center', fontSize: '13px', color: 'var(--color-success)' }}>
                  Trinkgeld: CHF {tip.toFixed(2)}
                </p>
              ) : <div style={{ marginBottom: '12px' }} />;
            })()}

            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="button secondary" onClick={() => setPayModal(null)} style={{ flex: 1 }}>
                Abbrechen
              </button>
              <button className="button primary" onClick={handlePay} style={{ flex: 1, background: 'var(--color-success)' }}>
                Kassieren
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      {confirmAction && (
        <ConfirmModal
          title={confirmAction.title}
          message={confirmAction.message}
          confirmLabel="Ja, fortfahren"
          onConfirm={confirmAction.onConfirm}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}
