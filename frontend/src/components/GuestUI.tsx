import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { useWebSocket } from '../services/useWebSocket';

interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
}

interface CartItem {
  productId: string;
  quantity: number;
  name: string;
  price: number;
}

interface PlacedOrder {
  id: string;
  order_number: number;
  status: string;
  total_amount: string;
  table_number: string;
}

export function GuestUI() {
  const [searchParams] = useSearchParams();
  const [tableNumber, setTableNumber] = useState<string>('');
  const [sessionError, setSessionError] = useState('');
  const [products, setProducts] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [placedOrder, setPlacedOrder] = useState<PlacedOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [orderError, setOrderError] = useState('');
  const [placing, setPlacing] = useState(false);

  const { lastMessage } = useWebSocket('guest');

  // Initialize session from QR token in URL
  useEffect(() => {
    const qrToken = searchParams.get('token');
    if (!qrToken) {
      setLoading(false);
      return;
    }

    const deviceId = localStorage.getItem('device_id') || `device-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem('device_id', deviceId);

    api.createSession(qrToken, deviceId).then((data: any) => {
      if (data.error) {
        setSessionError(data.error);
      } else if (!data.table_number || data.table_number === 'unknown') {
        setSessionError('Tisch nicht gefunden. Bitte wenden Sie sich an das Servicepersonal.');
      } else {
        setTableNumber(data.table_number);
      }
      setLoading(false);
    }).catch(() => {
      setSessionError('Ungültiger QR-Code');
      setLoading(false);
    });
  }, [searchParams]);

  // Load products
  useEffect(() => {
    api.getProducts().then((data: any) => {
      const items: MenuItem[] = (data.products || []).map((p: any) => ({ ...p, price: parseFloat(p.price) || 0 }));
      setProducts(items);
      const cats = [...new Set(items.map(p => p.category))];
      setCategories(cats);
      if (cats.length > 0) setActiveCategory(cats[0]!);
    });
  }, []);

  // Track order status via WebSocket — message shape: { event, data: order, timestamp }
  useEffect(() => {
    if (lastMessage?.event === 'order:updated' && placedOrder && lastMessage.data?.id === placedOrder.id) {
      setPlacedOrder(prev => prev ? { ...prev, status: lastMessage.data.status } : prev);
    }
  }, [lastMessage, placedOrder]);

  const fetchOrderStatus = useCallback(async (orderId: string) => {
    try {
      const data = await api.getOrder(orderId);
      if (data.id) setPlacedOrder(data);
    } catch {}
  }, []);

  // Poll order status every 10s after placing
  useEffect(() => {
    if (!placedOrder) return;
    if (placedOrder.status === 'served' || placedOrder.status === 'cancelled') return;
    const interval = setInterval(() => fetchOrderStatus(placedOrder.id), 10000);
    return () => clearInterval(interval);
  }, [placedOrder, fetchOrderStatus]);

  const handleAddItem = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(c => c.productId === item.id);
      if (existing) {
        return prev.map(c => c.productId === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, { productId: item.id, quantity: 1, name: item.name, price: item.price }];
    });
  };

  const handleRemoveItem = (productId: string) => {
    setCart(prev => {
      const existing = prev.find(c => c.productId === productId);
      if (existing && existing.quantity > 1) {
        return prev.map(c => c.productId === productId ? { ...c, quantity: c.quantity - 1 } : c);
      }
      return prev.filter(c => c.productId !== productId);
    });
  };

  const placeOrder = async () => {
    if (!tableNumber || placing) return;
    setPlacing(true);
    setOrderError('');
    try {
      const data = await api.createGuestOrder({
        table_id: tableNumber,
        items: cart.map(item => ({
          product_id: item.productId,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        })),
      });
      if (data.id) {
        setPlacedOrder({ id: data.id, order_number: data.order_number, status: data.status, total_amount: data.total_amount, table_number: data.table_number });
        setCart([]);
      }
    } catch {
      setOrderError('Bestellung fehlgeschlagen. Bitte erneut versuchen.');
    } finally {
      setPlacing(false);
    }
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Bestellung eingegangen';
      case 'preparing': return 'Wird zubereitet';
      case 'ready': return 'Bereit zum Servieren!';
      case 'served': return 'Guten Appetit!';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'var(--color-warning)';
      case 'preparing': return 'var(--color-info)';
      case 'ready': return 'var(--color-success)';
      case 'served': return 'var(--color-success)';
      default: return 'var(--color-secondary)';
    }
  };

  // No QR token: show landing
  const qrToken = searchParams.get('token');
  if (!qrToken) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', maxWidth: '400px', margin: '0 auto', marginTop: '80px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '8px' }}>immerdra.ch</h1>
        <p style={{ color: 'var(--color-secondary)', marginBottom: '32px' }}>Bitte scannen Sie den QR-Code an Ihrem Tisch, um zu bestellen.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', marginTop: '80px' }}>
        <p style={{ color: 'var(--color-secondary)' }}>Laden...</p>
      </div>
    );
  }

  if (sessionError) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', maxWidth: '400px', margin: '0 auto', marginTop: '80px' }}>
        <p style={{ color: 'var(--color-error)', fontWeight: '600' }}>{sessionError}</p>
        <p style={{ color: 'var(--color-secondary)', fontSize: '14px' }}>Bitte wenden Sie sich an das Servicepersonal.</p>
      </div>
    );
  }

  // Order placed: show tracking
  if (placedOrder) {
    return (
      <div style={{ padding: '24px', maxWidth: '500px', margin: '0 auto', textAlign: 'center' }}>
        <h1 style={{ fontSize: '24px', marginBottom: '4px' }}>Bestellung #{String(placedOrder.order_number || 0).padStart(3, '0')}</h1>
        <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: 'var(--color-secondary)' }}>Tisch {placedOrder.table_number}</p>

        <div className="card" style={{ padding: '32px', marginBottom: '24px' }}>
          <p style={{ margin: '0 0 12px 0', fontSize: '14px', color: 'var(--color-secondary)' }}>Bestellstatus</p>
          <div style={{
            display: 'inline-block',
            background: getStatusColor(placedOrder.status),
            color: 'white',
            padding: '8px 20px',
            borderRadius: 'var(--radius-md)',
            fontWeight: '600',
            fontSize: '18px',
            marginBottom: '12px',
          }}>
            {getStatusLabel(placedOrder.status)}
          </div>
          <p style={{ margin: '8px 0 0 0', color: 'var(--color-secondary)', fontSize: '14px' }}>
            Gesamt: CHF {parseFloat(placedOrder.total_amount).toFixed(2)}
          </p>
        </div>

        <button
          className="button primary"
          style={{ width: '100%', height: '48px', fontSize: '16px' }}
          onClick={() => setPlacedOrder(null)}
        >
          {placedOrder.status === 'served' ? 'Weitere Bestellung aufgeben' : 'Zurück zur Karte'}
        </button>
      </div>
    );
  }

  // Main menu
  const visibleProducts = activeCategory
    ? products.filter(p => p.category === activeCategory)
    : products;

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ padding: '16px', borderBottom: '1px solid var(--color-gray-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ margin: 0, fontSize: '11px', color: 'var(--color-secondary)', fontWeight: '500', letterSpacing: '0.5px' }}>immerdra.ch</p>
          <h1 style={{ margin: 0, fontSize: '22px' }}>Speisekarte</h1>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ color: 'var(--color-secondary)', fontSize: '14px' }}>Tisch {tableNumber}</span>
          {cartCount > 0 && (
            <p style={{ margin: '2px 0 0 0', fontSize: '12px', fontWeight: '600', color: 'var(--color-primary)' }}>
              {cartCount} im Warenkorb
            </p>
          )}
        </div>
      </div>

      {/* Category tabs */}
      <div style={{ overflowX: 'auto', display: 'flex', gap: '8px', padding: '12px 16px', borderBottom: '1px solid var(--color-gray-200)', scrollbarWidth: 'none', msOverflowStyle: 'none' } as any}>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            style={{
              flexShrink: 0,
              padding: '6px 14px',
              borderRadius: '20px',
              border: '1px solid var(--color-gray-200)',
              background: activeCategory === cat ? 'var(--color-black)' : 'transparent',
              color: activeCategory === cat ? 'var(--color-white)' : 'var(--color-primary)',
              fontFamily: 'var(--font-system)',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Product list */}
      <div style={{ padding: '16px', paddingBottom: cart.length > 0 ? '120px' : '16px', display: 'grid', gap: '10px' }}>
        {visibleProducts.map(product => {
          const inCart = cart.find(c => c.productId === product.id);
          return (
            <div
              key={product.id}
              className="card"
              onClick={() => handleAddItem(product)}
              style={{ cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: '0 0 2px 0', fontSize: '16px' }}>{product.name}</h3>
                  <p style={{ margin: 0, color: 'var(--color-secondary)', fontSize: '12px' }}>{product.category}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {inCart && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        className="button secondary"
                        onClick={e => { e.stopPropagation(); handleRemoveItem(product.id); }}
                        style={{ width: '32px', height: '32px', padding: 0, fontSize: '18px' }}
                      >
                        -
                      </button>
                      <span style={{ fontWeight: '600', minWidth: '20px', textAlign: 'center' }}>{inCart.quantity}</span>
                    </div>
                  )}
                  <span style={{ fontSize: '17px', fontWeight: '600' }}>CHF {product.price.toFixed(2)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Cart footer */}
      {cart.length > 0 && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          padding: '16px',
          background: 'var(--color-white)',
          borderTop: '1px solid var(--color-gray-200)',
        }}>
          <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            {orderError && (
              <p style={{ color: 'var(--color-error)', fontSize: '14px', marginBottom: '8px', textAlign: 'center' }}>{orderError}</p>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ color: 'var(--color-secondary)' }}>{cartCount} Artikel</span>
              <span style={{ fontWeight: '700', fontSize: '18px' }}>CHF {cartTotal.toFixed(2)}</span>
            </div>
            <button
              className="button primary"
              style={{ width: '100%', height: '48px', fontSize: '16px' }}
              onClick={placeOrder}
              disabled={placing}
            >
              {placing ? 'Wird bestellt...' : 'Bestellen'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
