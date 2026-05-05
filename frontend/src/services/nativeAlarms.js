/**
 * Native Alarms Service
 * 
 * Custom implementation using Android's AlarmManager directly
 * to bypass the broken Capacitor LocalNotifications plugin
 */

import { Capacitor } from '@capacitor/core';
import { registerPlugin } from '@capacitor/core';

// Register the native plugin
const LocalAlarms = registerPlugin('LocalAlarms');

const TAG = '[NativeAlarms]';

/**
 * Check if running on native platform
 */
export const isNative = () => {
  return Capacitor.isNativePlatform();
};

/**
 * Request notification permissions
 */
export const requestPermissions = async () => {
  console.log(`${TAG} Requesting permissions...`);
  
  if (!isNative()) {
    console.log(`${TAG} Not on native platform, skipping permission request`);
    return { granted: false };
  }
  
  try {
    const result = await LocalAlarms.requestPermissions();
    console.log(`${TAG} Permission result:`, result);
    return result;
  } catch (error) {
    console.error(`${TAG} Error requesting permissions:`, error);
    return { granted: false, error: error.message };
  }
};

/**
 * Check if permissions are granted
 */
export const checkPermissions = async () => {
  console.log(`${TAG} Checking permissions...`);
  
  if (!isNative()) {
    return { granted: false };
  }
  
  try {
    const result = await LocalAlarms.checkPermissions();
    console.log(`${TAG} Permission status:`, result);
    return result;
  } catch (error) {
    console.error(`${TAG} Error checking permissions:`, error);
    return { granted: false, error: error.message };
  }
};

/**
 * Schedule notifications using native AlarmManager
 * 
 * @param {Array} notifications - Array of notification objects
 * Each notification should have:
 * - id: unique integer
 * - title: string
 * - body: string
 * - scheduleAt: Unix timestamp in milliseconds
 * - channelId: (optional) notification channel
 * - urgency: (optional) 'gentle', 'normal', 'followup', 'urgent'
 */
export const scheduleNotifications = async (notifications) => {
  console.log(`${TAG} Scheduling ${notifications.length} notifications...`);
  
  if (!isNative()) {
    console.warn(`${TAG} Not on native platform, cannot schedule`);
    return { scheduled: 0 };
  }
  
  if (!Array.isArray(notifications) || notifications.length === 0) {
    console.warn(`${TAG} Invalid notifications array`);
    return { scheduled: 0 };
  }
  
  try {
    // Log each notification for debugging
    notifications.forEach(notif => {
      const scheduleDate = new Date(notif.scheduleAt);
      console.log(`${TAG} - ID ${notif.id}: "${notif.title}" at ${scheduleDate.toISOString()}`);
    });
    
    const result = await LocalAlarms.scheduleNotifications({ notifications });
    console.log(`${TAG} Scheduled successfully:`, result);
    return result;
  } catch (error) {
    console.error(`${TAG} Error scheduling notifications:`, error);
    throw error;
  }
};

/**
 * Schedule repeating alarms with medication metadata
 * This enables self-rescheduling alarms that persist across app restarts
 * 
 * @param {Array} alarms - Array of alarm objects with metadata
 * Each alarm should have:
 * - id: unique integer
 * - title: string
 * - body: string
 * - scheduleAt: Unix timestamp in milliseconds (first occurrence)
 * - medicationId: string (for tracking)
 * - medicationName: string
 * - frequency: 'daily' | 'weekly'
 * - time: string (HH:MM format, e.g., "09:00")
 * - weeklyDays: string (JSON array, e.g., "['mon','wed','fri']")
 * - endDate: string (YYYY-MM-DD format, optional)
 * - channelId: (optional) notification channel
 * - urgency: (optional) 'alarm' for medication alarms
 */
export const scheduleRepeatingAlarms = async (alarms) => {
  console.log(`${TAG} Scheduling ${alarms.length} REPEATING alarms...`);
  
  if (!isNative()) {
    console.warn(`${TAG} Not on native platform, cannot schedule repeating alarms`);
    return { scheduled: 0 };
  }
  
  if (!Array.isArray(alarms) || alarms.length === 0) {
    console.warn(`${TAG} Invalid alarms array`);
    return { scheduled: 0 };
  }
  
  try {
    // Log each alarm for debugging
    alarms.forEach(alarm => {
      const scheduleDate = new Date(alarm.scheduleAt);
      console.log(`${TAG} - Repeating: ${alarm.medicationName} (${alarm.frequency}) at ${alarm.time} (first: ${scheduleDate.toISOString()})`);
    });
    
    // Use the same scheduleNotifications method - the native plugin handles the metadata
    const result = await LocalAlarms.scheduleNotifications({ notifications: alarms });
    console.log(`${TAG} Repeating alarms scheduled successfully:`, result);
    return result;
  } catch (error) {
    console.error(`${TAG} Error scheduling repeating alarms:`, error);
    throw error;
  }
};

/**
 * Cancel a specific notification
 */
export const cancelNotification = async (id) => {
  console.log(`${TAG} Cancelling notification ${id}...`);
  
  if (!isNative()) {
    return { cancelled: false };
  }
  
  try {
    const result = await LocalAlarms.cancelNotification({ id });
    console.log(`${TAG} Cancelled notification ${id}:`, result);
    return result;
  } catch (error) {
    console.error(`${TAG} Error cancelling notification:`, error);
    throw error;
  }
};

/**
 * Cancel all notifications
 */
export const cancelAllNotifications = async () => {
  console.log(`${TAG} Cancelling all notifications...`);
  
  if (!isNative()) {
    return { cancelled: 0 };
  }
  
  try {
    const result = await LocalAlarms.cancelAllNotifications();
    console.log(`${TAG} Cancelled all notifications:`, result);
    return result;
  } catch (error) {
    console.error(`${TAG} Error cancelling all notifications:`, error);
    throw error;
  }
};

/**
 * Initialize the notification system
 * Call this on app startup
 */
export const initialize = async () => {
  console.log(`${TAG} Initializing native alarm system...`);
  
  if (!isNative()) {
    console.log(`${TAG} Not on native platform, skipping initialization`);
    return { initialized: false, reason: 'not_native' };
  }
  
  try {
    // Check if permissions are already granted
    const permStatus = await checkPermissions();
    
    if (!permStatus.granted) {
      console.log(`${TAG} Permissions not granted, requesting...`);
      const requestResult = await requestPermissions();
      
      if (!requestResult.granted) {
        console.error(`${TAG} Permissions denied`);
        return { initialized: false, reason: 'permissions_denied' };
      }
    }
    
    console.log(`${TAG} Initialization complete`);
    return { initialized: true };
  } catch (error) {
    console.error(`${TAG} Initialization error:`, error);
    return { initialized: false, reason: error.message };
  }
};

export default {
  isNative,
  initialize,
  requestPermissions,
  checkPermissions,
  scheduleNotifications,
  scheduleRepeatingAlarms,
  cancelNotification,
  cancelAllNotifications
};
