import axios from 'axios';

const API_BASE = process.env.REACT_APP_BACKEND_URL;

const api = axios.create({
  baseURL: `${API_BASE}/api/inv`,
  withCredentials: true,
});

// Add auth token from localStorage
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('session_token');
  if (token) {
    config.headers.Cookie = `session_token=${token}`;
  }
  return config;
});

export const invoiceAPI = {
  // Invoices
  create: (data) => api.post('/invoices', data),
  list: (params) => api.get('/invoices', { params }),
  get: (id) => api.get(`/invoices/${id}`),
  delete: (id) => api.delete(`/invoices/${id}`),
  deleteAllUnpaid: () => api.delete('/invoices/bulk/unpaid'),
  getPublic: (id, token) => api.get(`/invoices/public/${id}/${token}`),
  customerInvoices: () => api.get('/customer/invoices'),
  updateTracking: (id, data) => api.put(`/invoices/${id}/tracking`, data),
  exportCSV: () => api.get('/export/invoices', { responseType: 'blob' }),
};

export const productAPI = {
  list: (params) => api.get('/products', { params }),
  listAll: () => api.get('/products/all'),
};

export const couponAPI = {
  create: (data) => api.post('/coupons', data),
  list: () => api.get('/coupons'),
  update: (id, data) => api.put(`/coupons/${id}`, data),
  delete: (id) => api.delete(`/coupons/${id}`),
  validate: (data) => api.post('/coupons/validate', data),
};

export const sellerAPI = {
  get: () => api.get('/settings/seller'),
  getPublic: () => api.get('/settings/seller/public'),
  update: (data) => api.put('/settings/seller', data),
};

export const paymentAPI = {
  createOrder: (data) => api.post('/payments/create-order', data),
  verify: (data) => api.post('/payments/verify', data),
};

export const monitorAPI = {
  cod: () => api.get('/monitor/cod'),
  online: () => api.get('/monitor/online'),
};

export const customerAPI = {
  list: (search) => api.get('/customers', { params: { search } }),
  get: (id) => api.get(`/customers/${id}`),
  history: (id) => api.get(`/customers/${id}/history`),
};

export const analyticsAPI = {
  dashboard: () => api.get('/analytics/dashboard'),
};

export const generateFromMedications = (userId) =>
  api.get(`/generate-from-medications/${userId}`);

export default api;
