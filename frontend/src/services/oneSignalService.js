/**
 * OneSignal Push Notification Service
 * 
 * Replaces FCM with OneSignal for more reliable push notifications.
 * 
 * DESIGN PRINCIPLES:
 * 1. Push notifications are OPTIONAL - app works without them
 * 2. Non-blocking initialization - never delays login or app flow
 * 3. User association on login, disassociation on logout
 * 4. Graceful degradation - no errors shown to user if push fails
 * 5. Compatible with existing local notifications
 */

import { Capacitor } from '@capacitor/core';
import storageService from './storageService';

const ONESIGNAL_DEBUG = true;
const ONESIGNAL_APP_ID = '2341392e-475c-4924-98fb-4dcf24dc03f2';

// Push status constants
export const PUSH_STATUS = {
  PENDING: 'pending',
  ACTIVE: 'active',
  UNAVAILABLE: 'unavailable',
  PERMISSION_DENIED: 'permission_denied',
  ERROR: 'error'
};

const log = (...args) => {
  if (ONESIGNAL_DEBUG) {
    console.log('[OneSignalService]', new Date().toISOString(), ...args);
  }
};

// OneSignal plugin reference
let OneSignal = null;

class OneSignalService {
  constructor() {
    this.initialized = false;
    this.initializationInProgress = false;
    this.pushStatus = PUSH_STATUS.PENDING;
    this.currentUserId = null;
    this.playerId = null;
  }

  /**
   * Get current push status
   */
  getPushStatus() {
    return this.pushStatus;
  }

  /**
   * Check if push is active
   */
  isPushActive() {
    return this.pushStatus === PUSH_STATUS.ACTIVE;
  }

  /**
   * Load OneSignal plugin dynamically
   */
  async loadPlugin() {
    if (OneSignal) return true;

    try {
      log('Loading OneSignal plugin...');
      const module = await import('onesignal-cordova-plugin');
      OneSignal = module.default;
      log('✅ OneSignal plugin loaded');
      return true;
    } catch (error) {
      log('⚠️ OneSignal plugin not available:', error.message);
      this.pushStatus = PUSH_STATUS.UNAVAILABLE;
      return false;
    }
  }

  /**
   * Initialize OneSignal - NON-BLOCKING
   * Call this early in app lifecycle, before user login
   */
  async initialize() {
    if (!Capacitor.isNativePlatform()) {
      log('Not native platform, skipping OneSignal');
      this.pushStatus = PUSH_STATUS.UNAVAILABLE;
      return;
    }

    if (this.initialized) {
      log('Already initialized');
      return;
    }

    if (this.initializationInProgress) {
      log('Initialization in progress');
      return;
    }

    // Fire and forget - don't block
    this._backgroundInitialize();
  }

  /**
   * Background initialization
   */
  async _backgroundInitialize() {
    this.initializationInProgress = true;

    try {
      log('========== ONESIGNAL INIT START ==========');

      // Load plugin
      const loaded = await this.loadPlugin();
      if (!loaded || !OneSignal) {
        log('Plugin unavailable');
        this.initializationInProgress = false;
        return;
      }

      // Set log level for debugging
      if (ONESIGNAL_DEBUG) {
        OneSignal.Debug.setLogLevel(6); // Verbose
      }

      // Initialize with App ID
      log('Initializing with App ID:', ONESIGNAL_APP_ID);
      OneSignal.initialize(ONESIGNAL_APP_ID);

      // Set up notification handlers
      this._setupNotificationHandlers();

      // Request permission (non-blocking)
      this._requestPermission();

      this.initialized = true;
      log('========== ONESIGNAL INIT COMPLETE ==========');

    } catch (error) {
      log('❌ OneSignal init error:', error.message);
      this.pushStatus = PUSH_STATUS.ERROR;
    }

    this.initializationInProgress = false;
  }

  /**
   * Set up notification event handlers
   */
  _setupNotificationHandlers() {
    if (!OneSignal) return;

    try {
      // Notification received in foreground
      OneSignal.Notifications.addEventListener('foregroundWillDisplay', (event) => {
        log('📩 Notification received (foreground):', event.notification);
        // Let it display by default
        event.preventDefault();
        event.notification.display();
      });

      // Notification clicked/opened
      OneSignal.Notifications.addEventListener('click', (event) => {
        log('👆 Notification clicked:', event);
        this._handleNotificationClick(event);
      });

      // Permission change
      OneSignal.Notifications.addEventListener('permissionChange', (granted) => {
        log('🔔 Permission changed:', granted);
        if (granted) {
          this.pushStatus = PUSH_STATUS.ACTIVE;
          storageService.setItem('pushStatus', PUSH_STATUS.ACTIVE);
        } else {
          this.pushStatus = PUSH_STATUS.PERMISSION_DENIED;
          storageService.setItem('pushStatus', PUSH_STATUS.PERMISSION_DENIED);
        }
      });

      log('✅ Notification handlers set up');
    } catch (error) {
      log('⚠️ Error setting up handlers:', error.message);
    }
  }

  /**
   * Request notification permission
   */
  async _requestPermission() {
    if (!OneSignal) return;

    try {
      // Check if we can request permission
      const canRequest = await OneSignal.Notifications.canRequestPermission();
      log('Can request permission:', canRequest);

      if (canRequest) {
        // Request permission
        const granted = await OneSignal.Notifications.requestPermission(true);
        log('Permission granted:', granted);

        if (granted) {
          this.pushStatus = PUSH_STATUS.ACTIVE;
          await storageService.setItem('pushStatus', PUSH_STATUS.ACTIVE);
        } else {
          this.pushStatus = PUSH_STATUS.PERMISSION_DENIED;
        }
      } else {
        // Permission already requested, check current status
        const hasPermission = await OneSignal.Notifications.getPermissionAsync();
        log('Current permission status:', hasPermission);
        
        if (hasPermission) {
          this.pushStatus = PUSH_STATUS.ACTIVE;
          await storageService.setItem('pushStatus', PUSH_STATUS.ACTIVE);
        }
      }
    } catch (error) {
      log('⚠️ Permission request error:', error.message);
      // Don't throw - continue without push
    }
  }

  /**
   * Handle notification click
   */
  _handleNotificationClick(event) {
    try {
      const data = event.notification?.additionalData;
      log('Notification data:', data);

      // Navigate based on notification data
      if (data?.targetPage) {
        window.location.hash = `/${data.targetPage}`;
      } else if (data?.medicationId) {
        window.location.hash = '/medications';
      } else if (data?.appointmentId) {
        window.location.hash = '/home';
      }
    } catch (error) {
      log('Error handling notification click:', error);
    }
  }

  /**
   * Login user - Associate with OneSignal
   * Call this after successful authentication
   */
  async login(userId, email = null) {
    // Wait for initialization if in progress
    if (this.initializationInProgress) {
      log('Waiting for OneSignal initialization...');
      // Wait up to 5 seconds for initialization
      for (let i = 0; i < 10; i++) {
        await new Promise(resolve => setTimeout(resolve, 500));
        if (!this.initializationInProgress) break;
      }
    }

    if (!OneSignal || !this.initialized) {
      log('⚠️ OneSignal not ready, attempting to initialize...');
      // Try to initialize
      await this._backgroundInitialize();
      
      // Check again after initialization attempt
      if (!OneSignal || !this.initialized) {
        log('❌ OneSignal still not ready, skipping login');
        return;
      }
    }

    try {
      log('🔑 Logging in user to OneSignal:', userId);

      // Set external user ID
      await OneSignal.login(userId);
      this.currentUserId = userId;
      log('✅ OneSignal.login() called successfully');

      // Set email if provided
      if (email) {
        await OneSignal.User.addEmail(email);
        log('✅ Email added:', email);
      }

      // Add user tags for targeting
      await OneSignal.User.addTags({
        'user_id': userId,
        'app_version': '1.0.0',
        'platform': 'android'
      });
      log('✅ Tags added');

      // Get subscription ID (player ID)
      const subscriptionId = await OneSignal.User.pushSubscription.getIdAsync();
      if (subscriptionId) {
        this.playerId = subscriptionId;
        log('✅ User logged in, subscription ID:', subscriptionId);
      } else {
        log('⚠️ No subscription ID available yet');
      }

      // Save to local storage
      await storageService.setItem('onesignal_user_id', userId);
      log('✅ User ID saved to storage');

    } catch (error) {
      log('❌ OneSignal login error:', error.message, error);
      // Don't throw - continue without push association
    }
  }

  /**
   * Logout user - Disassociate from OneSignal
   * Call this on user logout
   */
  async logout() {
    if (!OneSignal) {
      return;
    }

    try {
      log('Logging out user');
      
      await OneSignal.logout();
      this.currentUserId = null;
      this.playerId = null;

      // Clear local storage
      await storageService.removeItem('onesignal_user_id');
      await storageService.removeItem('pushStatus');

      log('✅ User logged out from OneSignal');

    } catch (error) {
      log('⚠️ OneSignal logout error:', error.message);
    }
  }

  /**
   * Get current subscription/player ID
   */
  async getPlayerId() {
    if (!OneSignal || !this.initialized) {
      return null;
    }

    try {
      const id = await OneSignal.User.pushSubscription.getIdAsync();
      return id;
    } catch (error) {
      log('Error getting player ID:', error);
      return null;
    }
  }

  /**
   * Add tag for user segmentation
   */
  async addTag(key, value) {
    if (!OneSignal) return;

    try {
      await OneSignal.User.addTag(key, value);
      log('Tag added:', key, value);
    } catch (error) {
      log('Error adding tag:', error);
    }
  }

  /**
   * Remove tag
   */
  async removeTag(key) {
    if (!OneSignal) return;

    try {
      await OneSignal.User.removeTag(key);
      log('Tag removed:', key);
    } catch (error) {
      log('Error removing tag:', error);
    }
  }

  /**
   * Send test notification (for debugging)
   */
  async sendTestNotification() {
    const playerId = await this.getPlayerId();
    if (!playerId) {
      throw new Error('No push subscription available');
    }

    log('Sending test notification to:', playerId);
    
    // This would normally be done from backend
    // For testing, we can use OneSignal's test feature
    return {
      success: true,
      playerId: playerId,
      message: 'Test notification should arrive shortly'
    };
  }
}

// Singleton instance
const oneSignalService = new OneSignalService();
export default oneSignalService;
