const API_URL = import.meta.env.VITE_API_URL || '';

async function request(path: string, options?: RequestInit) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  return res.json();
}

// Orders
export const api = {
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
