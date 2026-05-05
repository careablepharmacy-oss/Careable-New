/**
 * Permission Manager Service
 * 
 * Handles contextual permission requests for:
 * - Notification permission (Android 13+)
 * - Exact alarm permission (Android 12+)
 * - Battery optimization exemption (user-guided)
 * 
 * Design Principles:
 * - Ask permissions only when needed
 * - Never block app functionality on permission denial
 * - Provide graceful fallbacks
 */

import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import storageService from './storageService';

const PERMISSION_DEBUG = true;

const log = (...args) => {
  if (PERMISSION_DEBUG) {
    console.log('[PermissionManager]', ...args);
  }
};

class PermissionManager {
  constructor() {
    this.permissionsChecked = false;
    this.notificationPermissionGranted = false;
    this.exactAlarmPermissionGranted = false;
  }

  /**
   * Check if running on native platform
   */
  isNative() {
    return Capacitor.isNativePlatform();
  }

  /**
   * Get Android version (approximation based on API behavior)
   */
  async getAndroidVersion() {
    // We can't directly get Android version from Capacitor
    // But we can infer from permission behavior
    return 'unknown';
  }

  /**
   * Request notification permission
   * Called contextually when user first interacts with notification features
   * 
   * @returns {Promise<boolean>} Whether permission was granted
   */
  async requestNotificationPermission() {
    if (!this.isNative()) {
      log('Not native platform, skipping notification permission');
      return true;
    }

    try {
      log('Requesting notification permission...');
      
      // Check current permission status
      const currentStatus = await LocalNotifications.checkPermissions();
      log('Current permission status:', currentStatus);

      if (currentStatus.display === 'granted') {
        log('✅ Notification permission already granted');
        this.notificationPermissionGranted = true;
        return true;
      }

      // Request permission
      const result = await LocalNotifications.requestPermissions();
      log('Permission request result:', result);

      this.notificationPermissionGranted = result.display === 'granted';
      
      // Save permission status
      await storageService.setItem('notificationPermissionGranted', 
        this.notificationPermissionGranted ? 'true' : 'false'
      );

      if (this.notificationPermissionGranted) {
        log('✅ Notification permission granted');
      } else {
        log('⚠️ Notification permission denied');
      }

      return this.notificationPermissionGranted;
    } catch (error) {
      log('❌ Error requesting notification permission:', error);
      return false;
    }
  }

  /**
   * Check if notification permission is granted
   */
  async checkNotificationPermission() {
    if (!this.isNative()) {
      return true;
    }

    try {
      const status = await LocalNotifications.checkPermissions();
      return status.display === 'granted';
    } catch (error) {
      log('Error checking notification permission:', error);
      return false;
    }
  }

  /**
   * Request exact alarm permission (Android 12+)
   * Called contextually when user schedules their first medication
   * 
   * Note: This is handled by the LocalNotifications plugin automatically
   * on Android 12+, but we track it for UX purposes
   */
  async requestExactAlarmPermission() {
    if (!this.isNative()) {
      return true;
    }

    try {
      log('Checking exact alarm permission...');
      
      // On Android 12+, exact alarms require special permission
      // The LocalNotifications plugin should handle this
      // We just track it for UX purposes
      
      const saved = await storageService.getItem('exactAlarmPermissionRequested');
      if (!saved) {
        await storageService.setItem('exactAlarmPermissionRequested', 'true');
        log('Exact alarm permission will be requested when scheduling alarms');
      }
      
      this.exactAlarmPermissionGranted = true;
      return true;
    } catch (error) {
      log('Error with exact alarm permission:', error);
      return false;
    }
  }

  /**
   * Check if reliability helper should be shown
   * Shows once after first successful login/medication add
   */
  async shouldShowReliabilityHelper() {
    if (!this.isNative()) {
      return false;
    }

    try {
      const shown = await storageService.getItem('reliabilityHelperShown');
      const skipped = await storageService.getItem('reliabilityHelperSkipped');
      
      // Don't show if already shown or skipped
      if (shown === 'true' || skipped === 'true') {
        return false;
      }

      // Show after user has logged in successfully
      const authFlag = await storageService.getAuthenticated();
      return authFlag === 'true';
    } catch (error) {
      log('Error checking reliability helper status:', error);
      return false;
    }
  }

  /**
   * Mark reliability helper as shown
   */
  async markReliabilityHelperShown() {
    await storageService.setItem('reliabilityHelperShown', 'true');
  }

  /**
   * Get all permission statuses for display in settings
   */
  async getAllPermissionStatuses() {
    const statuses = {
      notifications: false,
      exactAlarms: true, // Default to true, handled by system
      batteryOptimization: 'unknown'
    };

    if (!this.isNative()) {
      return { ...statuses, notifications: true };
    }

    try {
      // Check notification permission
      const notifStatus = await LocalNotifications.checkPermissions();
      statuses.notifications = notifStatus.display === 'granted';

      // Battery optimization is user-managed, we track if they've visited settings
      const batteryChecked = await storageService.getItem('batteryOptimizationChecked');
      statuses.batteryOptimization = batteryChecked === 'true' ? 'checked' : 'unchecked';

    } catch (error) {
      log('Error getting permission statuses:', error);
    }

    return statuses;
  }

  /**
   * Request all permissions at once (for settings page)
   */
  async requestAllPermissions() {
    const results = {
      notifications: false,
      exactAlarms: true
    };

    results.notifications = await this.requestNotificationPermission();
    results.exactAlarms = await this.requestExactAlarmPermission();

    return results;
  }
}

// Singleton instance
const permissionManager = new PermissionManager();
export default permissionManager;
