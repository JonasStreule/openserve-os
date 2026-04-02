const API_URL = import.meta.env.VITE_API_URL || '';

function getToken(): string | null {
  return localStorage.getItem('token');
}

async function request(path: string, options?: RequestInit & { noAuth?: boolean }) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token && !options?.noAuth) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (res.status === 401 && !path.includes('/auth/')) {
    const kioskRoutes = ['/kitchen', '/floor'];
    const isKiosk = kioskRoutes.some(r => window.location.pathname.startsWith(r));
    if (isKiosk) {
      window.dispatchEvent(new CustomEvent('kiosk:locked'));
    } else {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }

  return res.json();
}

export const api = {
  // Auth
  login: (username: string, pin: string) => request('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, pin }), noAuth: true } as any),
  getMe: () => request('/api/auth/me'),

  // Products (public)
  getProducts: () => request('/api/products', { noAuth: true } as any),
  getCategories: () => request('/api/products/categories', { noAuth: true } as any),
  createProduct: (data: any) => request('/api/products', { method: 'POST', body: JSON.stringify(data) }),
  updateProduct: (id: string, data: any) => request(`/api/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProduct: (id: string) => request(`/api/products/${id}`, { method: 'DELETE' }),

  // Tables
  getTables: () => request('/api/tables'),
  createTable: (data: any) => request('/api/tables', { method: 'POST', body: JSON.stringify(data) }),
  updateTable: (id: string, data: any) => request(`/api/tables/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTable: (id: string) => request(`/api/tables/${id}`, { method: 'DELETE' }),

  // Users
  getUsers: () => request('/api/users'),
  createUser: (data: any) => request('/api/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id: string, data: any) => request(`/api/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteUser: (id: string) => request(`/api/users/${id}`, { method: 'DELETE' }),

  // Guest (public)
  createSession: (qr_token: string, device_id: string) => request('/api/guests/session', { method: 'POST', body: JSON.stringify({ qr_token, device_id }), noAuth: true } as any),
  createGuestOrder: (data: any) => request('/api/orders', { method: 'POST', body: JSON.stringify(data), noAuth: true } as any),

  // Orders
  getOrders: () => request('/api/orders'),
  getOrder: (id: string) => request(`/api/orders/${id}`),
  createOrder: (data: any) => request('/api/orders', { method: 'POST', body: JSON.stringify(data) }),
  updateOrder: (id: string, status: string) => request(`/api/orders/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  cancelOrder: (id: string) => request(`/api/orders/${id}`, { method: 'DELETE' }),

  // Payments
  payOrder: (orderId: string, data: any) => request(`/api/orders/${orderId}/payment`, { method: 'POST', body: JSON.stringify(data) }),
  getPayments: (orderId: string) => request(`/api/orders/${orderId}/payments`),
  refundPayment: (paymentId: string) => request(`/api/payments/${paymentId}/refund`, { method: 'POST' }),

  // Cash
  openCash: (amount: number) => request('/api/cash/open', { method: 'POST', body: JSON.stringify({ opening_amount: amount }) }),
  closeCash: (amount: number, notes?: string) => request('/api/cash/close', { method: 'POST', body: JSON.stringify({ closing_amount: amount, notes }) }),
  getCashCurrent: () => request('/api/cash/current'),
  getCashHistory: () => request('/api/cash/history'),

  // Admin
  getMetrics: () => request('/api/admin/metrics'),
  getWeeklyMetrics: () => request('/api/admin/metrics/weekly'),
  getAuditLog: (limit = 50, offset = 0, entityType?: string) =>
    request(`/api/admin/audit?limit=${limit}&offset=${offset}${entityType ? `&entity_type=${entityType}` : ''}`),
  getLeaderboard: (period = 'daily') => request(`/api/admin/leaderboard?period=${period}`),
  addScore: (data: any) => request('/api/admin/leaderboard/score', { method: 'POST', body: JSON.stringify(data) }),
};
