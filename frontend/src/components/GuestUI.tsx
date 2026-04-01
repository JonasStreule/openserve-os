import { useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || '';

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

export function GuestUI() {
  const [scanned, setScanned] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderPlaced, setOrderPlaced] = useState(false);

  const mockProducts: MenuItem[] = [
    { id: '1', name: 'Pizza Margherita', price: 12.50, category: 'Pizza' },
    { id: '2', name: 'Pasta Carbonara', price: 13.00, category: 'Pasta' },
    { id: '3', name: 'Salad Green', price: 9.50, category: 'Salads' },
    { id: '4', name: 'Coke', price: 2.50, category: 'Drinks' },
    { id: '5', name: 'Tiramisu', price: 7.00, category: 'Desserts' },
    { id: '6', name: 'Bruschetta', price: 8.00, category: 'Starters' },
  ];

  const handleAddItem = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(c => c.productId === item.id);
      if (existing) {
        return prev.map(c =>
          c.productId === item.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, { productId: item.id, quantity: 1, name: item.name, price: item.price }];
    });
  };

  const handleRemoveItem = (productId: string) => {
    setCart(prev => {
      const existing = prev.find(c => c.productId === productId);
      if (existing && existing.quantity > 1) {
        return prev.map(c =>
          c.productId === productId ? { ...c, quantity: c.quantity - 1 } : c
        );
      }
      return prev.filter(c => c.productId !== productId);
    });
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const placeOrder = async () => {
    try {
      const response = await fetch(`${API_URL}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_id: 'T-5',
          items: cart.map(item => ({
            name: item.name,
            price: item.price,
            quantity: item.quantity,
          })),
        }),
      });

      if (response.ok) {
        setOrderPlaced(true);
        setCart([]);
        setTimeout(() => setOrderPlaced(false), 3000);
      }
    } catch (error) {
      console.error('Order failed:', error);
    }
  };

  if (!scanned) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', maxWidth: '400px', margin: '0 auto', marginTop: '80px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '8px' }}>OpenServe OS</h1>
        <p style={{ color: 'var(--color-secondary)', marginBottom: '32px' }}>Scan your table QR code to start ordering</p>
        <button
          className="button primary"
          onClick={() => setScanned(true)}
          style={{ width: '100%', fontSize: '18px', height: '52px' }}
        >
          Scan QR Code
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '16px', paddingBottom: '120px', maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ margin: 0, fontSize: '28px' }}>Menu</h1>
        <span style={{ color: 'var(--color-secondary)', fontSize: '14px' }}>Table T-5</span>
      </div>

      {orderPlaced && (
        <div style={{
          background: 'var(--color-success)',
          color: 'white',
          padding: '12px',
          borderRadius: 'var(--radius-md)',
          marginBottom: '16px',
          textAlign: 'center',
          fontWeight: '600',
        }}>
          Order placed successfully!
        </div>
      )}

      {/* Products Grid */}
      <div style={{ display: 'grid', gap: '12px' }}>
        {mockProducts.map(product => {
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
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '16px' }}>{product.name}</h3>
                  <p style={{ margin: 0, color: 'var(--color-secondary)', fontSize: '12px' }}>
                    {product.category}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {inCart && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        className="button secondary"
                        onClick={(e) => { e.stopPropagation(); handleRemoveItem(product.id); }}
                        style={{ width: '32px', height: '32px', padding: 0, fontSize: '18px' }}
                      >
                        -
                      </button>
                      <span style={{ fontWeight: '600', minWidth: '20px', textAlign: 'center' }}>
                        {inCart.quantity}
                      </span>
                    </div>
                  )}
                  <div style={{ fontSize: '18px', fontWeight: '600' }}>
                    {product.price.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Cart Footer */}
      {cart.length > 0 && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '16px',
          background: 'var(--color-gray-100)',
          borderTop: '1px solid var(--color-gray-200)',
        }}>
          <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span>Total:</span>
              <span style={{ fontSize: '18px', fontWeight: '600' }}>
                CHF {cartTotal.toFixed(2)}
              </span>
            </div>
            <button
              className="button primary"
              style={{ width: '100%', fontSize: '16px', height: '48px' }}
              onClick={placeOrder}
            >
              Place Order ({cartCount} {cartCount === 1 ? 'item' : 'items'})
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
