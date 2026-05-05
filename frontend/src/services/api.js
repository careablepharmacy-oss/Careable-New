import storageService from './storageService';

const API_URL = process.env.REACT_APP_BACKEND_URL;

class ApiService {
  async request(endpoint, options = {}) {
    // Get session token from storage (works for both native and web)
    const sessionToken = await storageService.getSessionToken();
    
    const config = {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(sessionToken && { 'Authorization': `Bearer ${sessionToken}` }),  // Add Authorization header
        ...options.headers,
      },
    };

    try {
      const response = await fetch(`${API_URL}${endpoint}`, config);
      
      console.log(`API ${endpoint} - Status: ${response.status}, Content-Type: ${response.headers.get('content-type')}`);
      
      if (response.status === 401) {
        // Only redirect if not already on login page
        if (!window.location.pathname.includes('/') || window.location.pathname.length > 1) {
          await storageService.removeAuthenticated();
          window.location.href = '/';
        }
        throw new Error('Unauthorized');
      }

      if (!response.ok) {
        let errorMessage = 'Request failed';
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
          const error = await response.json().catch(() => ({ detail: 'Request failed' }));
          errorMessage = error.detail || 'Request failed';
        } else {
          // Got HTML or other non-JSON response
          const text = await response.text();
          console.error(`Non-JSON response from ${endpoint}:`, text.substring(0, 200));
          errorMessage = `Server error (${response.status})`;
        }
        
        throw new Error(errorMessage);
      }

      // Check if response is JSON before parsing
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error(`Expected JSON but got: ${contentType}`, text.substring(0, 200));
        throw new Error('Invalid response format from server');
      }

      return response.json();
    } catch (error) {
      // If it's a network error and we're in development, show a helpful message
      if (error.message === 'Failed to fetch') {
        console.warn('Backend not accessible - using mock mode');
      }
      throw error;
    }
  }

  // Generic GET method
  async get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  }

  // Generic POST method
  async post(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Auth APIs
  async createSession(sessionId) {
    return this.request('/api/auth/session', {
      method: 'POST',
      body: JSON.stringify({ session_id: sessionId }),
    });
  }

  async getCurrentUser() {
    return this.request('/api/auth/me');
  }

  async logout() {
    return this.request('/api/auth/logout', { method: 'POST' });
  }

  // User APIs
  async getUserProfile() {
    return this.request('/api/users/me');
  }

  async updateUserProfile(data) {
    return this.request('/api/users/me', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Medication APIs
  async getMedications() {
    return this.request('/api/medications');
  }

  async createMedication(data) {
    return this.request('/api/medications', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateMedication(id, data) {
    return this.request(`/api/medications/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteMedication(id) {
    return this.request(`/api/medications/${id}`, {
      method: 'DELETE',
    });
  }

  // Adherence APIs
  async recordAdherence(data) {
    return this.request('/api/adherence', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getAdherence() {
    return this.request('/api/adherence');
  }

  // Additional Adherence APIs
  async getAdherenceLogs(startDate, endDate) {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    return this.request(`/api/adherence?${params.toString()}`);
  }

  async createAdherenceLog(data) {
    return this.request('/api/adherence', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateAdherenceLog(id, status, takenTime) {
    const params = new URLSearchParams({ status });
    if (takenTime) params.append('taken_time', takenTime);
    return this.request(`/api/adherence/${id}?${params.toString()}`, {
      method: 'PUT',
    });
  }

  // Health Metrics APIs
  async getBloodGlucose(startDate, endDate) {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    return this.request(`/api/health/glucose?${params.toString()}`);
  }

  async createBloodGlucose(data) {
    return this.request('/api/health/glucose', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getBloodPressure(startDate, endDate) {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    return this.request(`/api/health/bp?${params.toString()}`);
  }

  async createBloodPressure(data) {
    return this.request('/api/health/bp', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getBodyMetrics(startDate, endDate) {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    return this.request(`/api/health/metrics?${params.toString()}`);
  }

  async createBodyMetrics(data) {
    return this.request('/api/health/metrics', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Appointment APIs
  async getAppointments() {
    return this.request('/api/appointments');
  }

  async createAppointment(data) {
    return this.request('/api/appointments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateAppointmentStatus(appointmentId, status) {
    return this.request(`/api/appointments/${appointmentId}/status?status=${status}`, {
      method: 'PUT',
    });
  }

  // User Purchase Links APIs (for regular users)
  async getMyPurchaseLinks() {
    return this.request('/api/user/purchase-links');
  }

  async markProductOrderCompleted() {
    return this.request('/api/user/purchase-links/product-completed', {
      method: 'POST',
    });
  }

  // Notification Settings
  async getNotificationSettings() {
    return this.request('/api/settings/notifications');
  }

  async updateNotificationSettings(data) {
    return this.request('/api/settings/notifications', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Reminder APIs
  async getReminders(includeSent = false) {
    const params = includeSent ? '?include_sent=true' : '';
    return this.request(`/api/reminders${params}`);
  }

  async getUpcomingReminders() {
    return this.request('/api/reminders/upcoming');
  }

  async createReminder(data) {
    return this.request('/api/reminders', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteReminder(id) {
    return this.request(`/api/reminders/${id}`, {
      method: 'DELETE',
    });
  }

  // Push Notification APIs
  async subscribeToPush(subscription) {
    return this.request('/api/push/subscribe', {
      method: 'POST',
      body: JSON.stringify(subscription),
    });
  }

  async unsubscribeFromPush(endpoint) {
    return this.request('/api/push/unsubscribe', {
      method: 'POST',
      body: JSON.stringify({ endpoint }),
    });
  }

  async getVapidPublicKey() {
    return this.request('/api/push/vapid-public-key');
  }

  // ==================== PRESCRIPTION MANAGER APIs ====================
  
  async getAllUsersForManager() {
    return this.request('/api/prescription-manager/users');
  }

  async getUserDetailsForManager(userId) {
    return this.request(`/api/prescription-manager/user/${userId}`);
  }

  async getUserMedicationsForManager(userId) {
    return this.request(`/api/prescription-manager/user/${userId}/medications`);
  }

  async createMedicationForUser(userId, medication) {
    return this.request(`/api/prescription-manager/user/${userId}/medications`, {
      method: 'POST',
      body: JSON.stringify(medication),
    });
  }

  async updateMedicationForUser(userId, medicationId, medication) {
    return this.request(`/api/prescription-manager/user/${userId}/medications/${medicationId}`, {
      method: 'PUT',
      body: JSON.stringify(medication),
    });
  }

  async deleteMedicationForUser(userId, medicationId) {
    return this.request(`/api/prescription-manager/user/${userId}/medications/${medicationId}`, {
      method: 'DELETE',
    });
  }

  async addStockForUser(userId, medicationId, amount) {
    return this.request(`/api/prescription-manager/users/${userId}/medications/${medicationId}/add-stock?amount=${amount}`, {
      method: 'POST',
    });
  }

  async deleteUser(userId) {
    return this.request(`/api/prescription-manager/user/${userId}`, {
      method: 'DELETE',
    });
  }

  async updateUserForManager(userId, userData) {
    return this.request(`/api/prescription-manager/user/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  }

  // User Purchase Links Management (Prescription Manager)
  async getUserPurchaseLinks(userId) {
    return this.request(`/api/prescription-manager/user/${userId}/purchase-links`);
  }

  async updateUserPurchaseLinks(userId, linksData) {
    return this.request(`/api/prescription-manager/user/${userId}/purchase-links`, {
      method: 'PUT',
      body: JSON.stringify(linksData),
    });
  }

  // Webhook Configuration Management
  async getWebhookConfig() {
    return this.request('/api/prescription-manager/webhook-config');
  }

  async updateWebhookConfig(webhookUrl, enabled = true, description = '') {
    return this.request(`/api/prescription-manager/webhook-config?webhook_url=${encodeURIComponent(webhookUrl)}&enabled=${enabled}&description=${encodeURIComponent(description)}`, {
      method: 'PUT',
    });
  }

  async testWebhook() {
    return this.request('/api/prescription-manager/webhook-test', {
      method: 'POST',
    });
  }

  // Database Cleanup (DANGEROUS)
  cleanupProductionDatabase(confirmationPassword) {
    return this.request('/api/prescription-manager/cleanup-database', {
      method: 'POST',
      body: JSON.stringify({ confirmation_password: confirmationPassword })
    });
  }

  async getUserHealthReportsForManager(userId) {
    return this.request(`/api/prescription-manager/user/${userId}/health-reports`);
  }

  async getUserAppointmentHistory(userId, limit = 5) {
    return this.request(`/api/prescription-manager/user/${userId}/appointments?limit=${limit}`);
  }

  async createGlucoseReadingForUser(userId, reading) {
    return this.request(`/api/prescription-manager/user/${userId}/health/glucose`, {
      method: 'POST',
      body: JSON.stringify(reading),
    });
  }

  async createBPReadingForUser(userId, reading) {
    return this.request(`/api/prescription-manager/user/${userId}/health/bp`, {
      method: 'POST',
      body: JSON.stringify(reading),
    });
  }

  async createBodyMetricsForUser(userId, metrics) {
    return this.request(`/api/prescription-manager/user/${userId}/health/metrics`, {
      method: 'POST',
      body: JSON.stringify(metrics),
    });
  }

  // Admin Order Management
  async getAdminOrders() {
    return this.request('/api/admin/orders');
  }

  async updateOrderStatus(orderId, data) {
    return this.request(`/api/admin/orders/${orderId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }
}

export default new ApiService();
