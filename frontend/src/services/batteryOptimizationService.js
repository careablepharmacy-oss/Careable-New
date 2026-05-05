/**
 * Battery Optimization Service
 * Handles checking and requesting battery optimization exemption
 * This is critical for alarms to work reliably when phone is locked
 */

import { Capacitor, registerPlugin } from '@capacitor/core';

// Register the native plugin
const BatteryOptimization = registerPlugin('BatteryOptimization');

class BatteryOptimizationService {
  constructor() {
    this.isNative = Capacitor.isNativePlatform();
  }

  /**
   * Check if battery optimization is disabled for this app
   * @returns {Promise<boolean>} true if optimization is disabled (good for alarms)
   */
  async isIgnoringBatteryOptimizations() {
    if (!this.isNative) {
      console.log('[BatteryOpt] Not a native platform, returning true');
      return true;
    }

    try {
      const result = await BatteryOptimization.isIgnoringBatteryOptimizations();
      console.log('[BatteryOpt] Is ignoring battery optimizations:', result.isIgnoring);
      return result.isIgnoring;
    } catch (error) {
      console.error('[BatteryOpt] Error checking battery optimization:', error);
      return true; // Assume it's fine if we can't check
    }
  }

  /**
   * Open battery optimization settings for this app
   */
  async openBatteryOptimizationSettings() {
    if (!this.isNative) {
      console.log('[BatteryOpt] Not a native platform');
      return { success: false, reason: 'not_native' };
    }

    try {
      const result = await BatteryOptimization.openBatteryOptimizationSettings();
      console.log('[BatteryOpt] Opened battery settings:', result);
      return result;
    } catch (error) {
      console.error('[BatteryOpt] Error opening battery settings:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if exact alarms can be scheduled (Android 12+)
   */
  async canScheduleExactAlarms() {
    if (!this.isNative) {
      return true;
    }

    try {
      const result = await BatteryOptimization.canScheduleExactAlarms();
      console.log('[BatteryOpt] Can schedule exact alarms:', result.canSchedule);
      return result.canSchedule;
    } catch (error) {
      console.error('[BatteryOpt] Error checking exact alarm permission:', error);
      return true;
    }
  }

  /**
   * Open exact alarm settings (Android 12+)
   */
  async openExactAlarmSettings() {
    if (!this.isNative) {
      return { success: false, reason: 'not_native' };
    }

    try {
      const result = await BatteryOptimization.openExactAlarmSettings();
      return result;
    } catch (error) {
      console.error('[BatteryOpt] Error opening exact alarm settings:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get comprehensive permission status
   */
  async getPermissionStatus() {
    if (!this.isNative) {
      return {
        batteryOptimizationIgnored: true,
        canScheduleExactAlarms: true,
        notificationsEnabled: true,
        canUseFullScreenIntent: true,
        allPermissionsGranted: true,
        isNative: false
      };
    }

    try {
      const result = await BatteryOptimization.getPermissionStatus();
      console.log('[BatteryOpt] Permission status:', result);
      return { ...result, isNative: true };
    } catch (error) {
      console.error('[BatteryOpt] Error getting permission status:', error);
      return {
        batteryOptimizationIgnored: true,
        canScheduleExactAlarms: true,
        notificationsEnabled: true,
        canUseFullScreenIntent: true,
        allPermissionsGranted: true,
        isNative: true,
        error: error.message
      };
    }
  }

  /**
   * Open full screen intent settings (Android 14+)
   */
  async openFullScreenIntentSettings() {
    if (!this.isNative) {
      return { success: false, reason: 'not_native' };
    }

    try {
      const result = await BatteryOptimization.openFullScreenIntentSettings();
      return result;
    } catch (error) {
      console.error('[BatteryOpt] Error opening full screen intent settings:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if battery optimization prompt should be shown
   * Called before Add Medication page
   */
  async shouldShowBatteryOptimizationPrompt() {
    if (!this.isNative) {
      return false;
    }

    try {
      // Check if user has already dismissed the prompt recently
      const lastDismissed = localStorage.getItem('battery_opt_prompt_dismissed');
      if (lastDismissed) {
        const dismissedTime = parseInt(lastDismissed, 10);
        const oneWeek = 7 * 24 * 60 * 60 * 1000;
        if (Date.now() - dismissedTime < oneWeek) {
          console.log('[BatteryOpt] Prompt was dismissed recently, not showing');
          return false;
        }
      }

      // Check if already optimized
      const isIgnoring = await this.isIgnoringBatteryOptimizations();
      return !isIgnoring;
    } catch (error) {
      console.error('[BatteryOpt] Error checking if prompt should show:', error);
      return false;
    }
  }

  /**
   * Mark the prompt as dismissed
   */
  dismissPrompt() {
    localStorage.setItem('battery_opt_prompt_dismissed', Date.now().toString());
    console.log('[BatteryOpt] Prompt dismissed');
  }

  /**
   * Clear the dismissed state (for testing)
   */
  clearDismissedState() {
    localStorage.removeItem('battery_opt_prompt_dismissed');
    console.log('[BatteryOpt] Dismissed state cleared');
  }
}

const batteryOptimizationService = new BatteryOptimizationService();
export default batteryOptimizationService;
