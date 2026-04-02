import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { useWebSocket } from '../services/useWebSocket';

interface Table {
  id: string;
  table_number: string;
  capacity: number;
  x_pos: number;
  y_pos: number;
  section: string;
}

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  unit_price: string;
}

interface Order {
  id: string;
  table_number: string;
  status: string;
  payment_status: string;
  total_amount: string;
  items: OrderItem[];
}

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
}

type TableStatus = 'free' | 'pending' | 'preparing' | 'ready' | 'unpaid';

function getTableStatus(tableNumber: string, orders: Order[]): TableStatus {
  const active = orders.filter(
    o => o.table_number === tableNumber && o.payment_status === 'unpaid' && o.status !== 'cancelled'
  );
  if (active.length === 0) return 'free';
  if (active.some(o => o.status === 'ready')) return 'ready';
  if (active.some(o => o.status === 'preparing')) return 'preparing';
  return 'pending';
}

const STATUS_STYLE: Record<TableStatus, { bg: string; border: string; label: string; labelColor: string }> = {
  free:      { bg: 'white',   border: '#d1d5db', label: 'Frei',    labelColor: '#9ca3af' },
  pending:   { bg: '#fef3c7', border: '#f59e0b', label: 'Offen',   labelColor: '#92400e' },
  preparing: { bg: '#dbeafe', border: '#3b82f6', label: 'Zubereitung', labelColor: '#1e40af' },
  ready:     { bg: '#d1fae5', border: '#10b981', label: 'Bereit',  labelColor: '#065f46' },
  unpaid:    { bg: '#fee2e2', border: '#ef4444', label: 'Zahlung', labelColor: '#991b1b' },
};

// Compute bounding box for a section's tables
function sectionBounds(tables: Table[]) {
  const xs = tables.map(t => t.x_pos);
  const ys = tables.map(t => t.y_pos);
  const pad = 7;
  return {
    x: Math.min(...xs) - pad,
    y: Math.min(...ys) - pad,
    w: Math.max(...xs) - Math.min(...xs) + 22 + pad,
    h: Math.max(...ys) - Math.min(...ys) + 18 + pad,
  };
}

const SECTION_COLORS: Record<string, string> = {
  'Innenraum': '#fafaf8',
  'Bar':       '#f0f4ff',
  'Terrasse':  '#f0fff7',
  'Theke':     '#fff8f0',
  'Outdoor':   '#f0fff7',
};

export function FloorPlan() {
  const [tables, setTables] = useState<Table[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState<Table | null>(null);
  const [cart, setCart] = useState<{ product: Product; qty: number }[]>([]);
  const [activeCategory, setActiveCategory] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const { lastMessage, connected } = useWebSocket('service');

  const fetchData = useCallback(async () => {
    const [t, o] = await Promise.all([api.getTables(), api.getOrders()]);
    setTables(t.tables || []);
    setOrders(o.orders || []);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { if (lastMessage) fetchData(); }, [lastMessage, fetchData]);
  useEffect(() => {
    const iv = setInterval(fetchData, 8000);
    return () => clearInterval(iv);
  }, [fetchData]);

  useEffect(() => {
    api.getProducts().then((d: any) => {
      const ps: Product[] = d.products || [];
      setProducts(ps);
      const cats = [...new Set(ps.map((p: Product) => p.category))];
      if (cats.length > 0) setActiveCategory(cats[0]!);
    });
  }, []);

  const openTable = (table: Table) => {
    setSelected(table);
    setCart([]);
    setSuccessMsg('');
  };

  const closeModal = () => {
    setSelected(null);
    setCart([]);
    setSuccessMsg('');
  };

  const addToCart = (product: Product) => {
    setCart(prev => {
      const ex = prev.find(c => c.product.id === product.id);
      if (ex) return prev.map(c => c.product.id === product.id ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { product, qty: 1 }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => {
      const ex = prev.find(c => c.product.id === productId);
      if (ex && ex.qty > 1) return prev.map(c => c.product.id === productId ? { ...c, qty: c.qty - 1 } : c);
      return prev.filter(c => c.product.id !== productId);
    });
  };

  const submitOrder = async () => {
    if (!selected || cart.length === 0) return;
    setSubmitting(true);
    try {
      await api.createOrder({
        table_id: selected.table_number,
        items: cart.map(c => ({
          product_id: c.product.id,
          name: c.product.name,
          price: c.product.price,
          quantity: c.qty,
        })),
      });
      setSuccessMsg('Bestellung aufgegeben!');
      setCart([]);
      fetchData();
      setTimeout(() => { setSuccessMsg(''); }, 2000);
    } catch {
      // ignore
    }
    setSubmitting(false);
  };

  // Group tables by section
  const sections = tables.reduce<Record<string, Table[]>>((acc, t) => {
    const s = t.section || 'Innenraum';
    (acc[s] = acc[s] || []).push(t);
    return acc;
  }, {});

  const cartTotal = cart.reduce((s, c) => s + c.product.price * c.qty, 0);
  const cartCount = cart.reduce((s, c) => s + c.qty, 0);
  const categories = [...new Set(products.map(p => p.category))];
  const visibleProducts = products.filter(p => p.category === activeCategory);

  // Active orders for selected table
  const tableOrders = selected
    ? orders.filter(o => o.table_number === selected.table_number && o.payment_status === 'unpaid' && o.status !== 'cancelled')
    : [];

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '12px 20px', background: 'white', borderBottom: '1px solid var(--color-gray-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <h1 style={{ margin: 0, fontSize: '20px' }}>Tischplan</h1>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', fontSize: '12px' }}>
          {/* Legend */}
          {(['free', 'pending', 'preparing', 'ready'] as TableStatus[]).map(s => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: STATUS_STYLE[s].bg, border: `1px solid ${STATUS_STYLE[s].border}` }} />
              <span style={{ color: 'var(--color-secondary)' }}>{STATUS_STYLE[s].label}</span>
            </div>
          ))}
          <span style={{ color: connected ? 'var(--color-success)' : 'var(--color-error)', fontWeight: '600' }}>
            {connected ? '● Live' : '○ Offline'}
          </span>
        </div>
      </div>

      {/* Canvas */}
      <div style={{ flex: 1, overflow: 'hidden', padding: '16px', background: 'var(--color-gray-100)' }}>
        <div style={{ position: 'relative', width: '100%', paddingBottom: '58%', background: '#f9f7f4', borderRadius: '12px', border: '1px solid var(--color-gray-200)', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ position: 'absolute', inset: 0 }}>

            {/* Section backgrounds */}
            {Object.entries(sections).map(([sectionName, sectionTables]) => {
              const b = sectionBounds(sectionTables);
              return (
                <div key={sectionName} style={{
                  position: 'absolute',
                  left: `${b.x}%`, top: `${b.y}%`,
                  width: `${b.w}%`, height: `${b.h}%`,
                  background: SECTION_COLORS[sectionName] || '#fafafa',
                  border: '1px dashed #d1d5db',
                  borderRadius: '10px',
                }}>
                  <span style={{ position: 'absolute', top: '6px', left: '10px', fontSize: '11px', fontWeight: '600', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {sectionName}
                  </span>
                </div>
              );
            })}

            {/* Tables */}
            {tables.map(table => {
              const status = getTableStatus(table.table_number, orders);
              const style = STATUS_STYLE[status];
              const isStool = table.capacity === 1;
              return (
                <button
                  key={table.id}
                  onClick={() => openTable(table)}
                  title={`${table.table_number} · ${table.capacity} Plätze · ${style.label}`}
                  style={{
                    position: 'absolute',
                    left: `${table.x_pos}%`,
                    top: `${table.y_pos}%`,
                    transform: 'translate(-50%, -50%)',
                    width: isStool ? '54px' : table.capacity > 4 ? '88px' : '72px',
                    height: isStool ? '54px' : table.capacity > 4 ? '62px' : '52px',
                    background: style.bg,
                    border: `2px solid ${style.border}`,
                    borderRadius: isStool ? '50%' : '10px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '2px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    fontFamily: 'var(--font-system)',
                    transition: 'transform 0.1s, box-shadow 0.1s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translate(-50%, -50%) scale(1.06)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 3px 8px rgba(0,0,0,0.15)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translate(-50%, -50%) scale(1)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)'; }}
                >
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#374151' }}>
                    {table.table_number}
                  </span>
                  {!isStool && (
                    <span style={{ fontSize: '10px', color: style.labelColor, fontWeight: '500' }}>
                      {style.label}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Table Modal */}
      {selected && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 500, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={closeModal}
        >
          <div
            style={{ background: 'white', width: '100%', maxWidth: '780px', maxHeight: '82vh', borderRadius: '16px 16px 0 0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-gray-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div>
                <h2 style={{ margin: '0 0 2px 0', fontSize: '18px' }}>{selected.table_number}</h2>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-secondary)' }}>
                  {selected.section} · {selected.capacity} Plätze
                </p>
              </div>
              <button onClick={closeModal} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: 'var(--color-secondary)' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
              {/* Left: current orders */}
              <div style={{ width: '220px', flexShrink: 0, borderRight: '1px solid var(--color-gray-200)', padding: '12px', overflowY: 'auto' }}>
                <p style={{ margin: '0 0 10px 0', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', color: 'var(--color-secondary)', letterSpacing: '0.5px' }}>
                  Laufende Bestellungen
                </p>
                {tableOrders.length === 0 ? (
                  <p style={{ fontSize: '13px', color: 'var(--color-secondary)' }}>Keine offenen Bestellungen</p>
                ) : tableOrders.map(order => (
                  <div key={order.id} style={{ marginBottom: '12px', padding: '10px', background: 'var(--color-gray-100)', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', textTransform: 'capitalize', color: STATUS_STYLE[getTableStatus(order.table_number, [order])].border }}>
                        {STATUS_STYLE[getTableStatus(order.table_number, [order])].label}
                      </span>
                      <span style={{ fontSize: '12px', fontWeight: '600' }}>
                        CHF {parseFloat(order.total_amount).toFixed(2)}
                      </span>
                    </div>
                    {(order.items || []).map((item, i) => (
                      <div key={i} style={{ fontSize: '12px', color: 'var(--color-secondary)', padding: '1px 0' }}>
                        {item.quantity}× {item.name}
                      </div>
                    ))}
                  </div>
                ))}

                {/* Success message */}
                {successMsg && (
                  <div style={{ padding: '10px', background: 'var(--color-success)', color: 'white', borderRadius: '8px', fontSize: '13px', fontWeight: '600', textAlign: 'center', marginTop: '8px' }}>
                    {successMsg}
                  </div>
                )}
              </div>

              {/* Right: product picker */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* Category tabs */}
                <div style={{ display: 'flex', overflowX: 'auto', gap: '6px', padding: '10px 12px', borderBottom: '1px solid var(--color-gray-200)', flexShrink: 0 }}>
                  {categories.map(cat => (
                    <button key={cat} onClick={() => setActiveCategory(cat)} style={{
                      flexShrink: 0,
                      padding: '5px 12px',
                      borderRadius: '16px',
                      border: '1px solid var(--color-gray-200)',
                      background: activeCategory === cat ? 'var(--color-black)' : 'transparent',
                      color: activeCategory === cat ? 'white' : 'var(--color-primary)',
                      fontFamily: 'var(--font-system)',
                      fontSize: '12px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}>
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Products */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', display: 'grid', gap: '6px' }}>
                  {visibleProducts.map(product => {
                    const inCart = cart.find(c => c.product.id === product.id);
                    return (
                      <div key={product.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'var(--color-gray-100)', borderRadius: '8px' }}>
                        <span style={{ fontSize: '13px', fontWeight: '500' }}>{product.name}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '13px', fontWeight: '600' }}>CHF {product.price.toFixed(2)}</span>
                          {inCart && (
                            <>
                              <button onClick={() => removeFromCart(product.id)} style={{ width: '28px', height: '28px', borderRadius: '50%', border: '1px solid var(--color-gray-200)', background: 'white', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                              <span style={{ fontWeight: '700', minWidth: '16px', textAlign: 'center', fontSize: '14px' }}>{inCart.qty}</span>
                            </>
                          )}
                          <button onClick={() => addToCart(product)} style={{ width: '28px', height: '28px', borderRadius: '50%', border: 'none', background: 'var(--color-black)', color: 'white', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Cart footer */}
                {cart.length > 0 && (
                  <div style={{ padding: '12px', borderTop: '1px solid var(--color-gray-200)', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                    <div>
                      <span style={{ fontSize: '13px', color: 'var(--color-secondary)' }}>{cartCount} Position{cartCount !== 1 ? 'en' : ''} · </span>
                      <span style={{ fontSize: '16px', fontWeight: '700' }}>CHF {cartTotal.toFixed(2)}</span>
                    </div>
                    <button
                      className="button primary"
                      onClick={submitOrder}
                      disabled={submitting}
                      style={{ height: '40px', fontSize: '14px', minWidth: '160px' }}
                    >
                      {submitting ? 'Aufgeben...' : `Auf ${selected.table_number} buchen`}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
