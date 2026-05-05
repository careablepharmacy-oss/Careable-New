/**
 * Full-Screen Notification Service
 * 
 * Uses capacitor-fullscreen-notification plugin to show alarm-like notifications
 * that wake the device and show over lock screen
 */

import { Capacitor } from '@capacitor/core';
import { registerPlugin } from '@capacitor/core';

// Register the full-screen notification plugin
const FullScreenNotification = registerPlugin('FullScreenNotification');

const TAG = '[FullScreenNotification]';

/**
 * Check if running on native platform
 */
export const isNative = () => {
  return Capacitor.isNativePlatform();
};

/**
 * Check if full-screen intent permission is granted (Android 14+)
 */
export const checkPermission = async () => {
  console.log(`${TAG} Checking full-screen intent permission...`);
  
  if (!isNative()) {
    console.log(`${TAG} Not on native platform`);
    return { granted: false };
  }
  
  try {
    const result = await FullScreenNotification.checkPermission();
    console.log(`${TAG} Permission status:`, result);
    return result;
  } catch (error) {
    console.error(`${TAG} Error checking permission:`, error);
    // If method doesn't exist, assume permission is granted (older Android)
    return { granted: true };
  }
};

/**
 * Request full-screen intent permission (Android 14+)
 * This will direct user to settings to manually enable
 */
export const requestPermission = async () => {
  console.log(`${TAG} Requesting full-screen intent permission...`);
  
  if (!isNative()) {
    console.log(`${TAG} Not on native platform`);
    return { granted: false };
  }
  
  try {
    const result = await FullScreenNotification.requestPermission();
    console.log(`${TAG} Permission request result:`, result);
    return result;
  } catch (error) {
    console.error(`${TAG} Error requesting permission:`, error);
    return { granted: false };
  }
};

/**
 * Show a full-screen notification
 * This will wake the device and show over lock screen
 * 
 * @param {Object} options - Notification options
 * @param {number} options.id - Unique notification ID
 * @param {string} options.title - Notification title
 * @param {string} options.body - Notification body/message
 * @param {number} options.scheduleAt - Unix timestamp in milliseconds
 */
export const showFullScreen = async (options) => {
  console.log(`${TAG} Showing full-screen notification:`, options);
  
  if (!isNative()) {
    console.warn(`${TAG} Not on native platform`);
    return { success: false };
  }
  
  try {
    const result = await FullScreenNotification.show(options);
    console.log(`${TAG} Full-screen notification shown:`, result);
    return { success: true };
  } catch (error) {
    console.error(`${TAG} Error showing full-screen notification:`, error);
    return { success: false, error: error.message };
  }
};

/**
 * Schedule a full-screen notification
 * 
 * @param {Object} options - Notification options
 * @param {number} options.id - Unique notification ID
 * @param {string} options.title - Notification title
 * @param {string} options.body - Notification body/message
 * @param {number} options.scheduleAt - Unix timestamp in milliseconds
 */
export const schedule = async (options) => {
  console.log(`${TAG} Scheduling full-screen notification:`, options);
  
  if (!isNative()) {
    console.warn(`${TAG} Not on native platform`);
    return { success: false };
  }
  
  try {
    const result = await FullScreenNotification.schedule(options);
    console.log(`${TAG} Full-screen notification scheduled:`, result);
    return { success: true };
  } catch (error) {
    console.error(`${TAG} Error scheduling full-screen notification:`, error);
    return { success: false, error: error.message };
  }
};

/**
 * Add listener for when full-screen notification launches the app
 */
export const addLaunchListener = (callback) => {
  console.log(`${TAG} Adding launch listener...`);
  
  if (!isNative()) {
    console.log(`${TAG} Not on native platform`);
    return;
  }
  
  try {
    FullScreenNotification.addListener('launch', (data) => {
      console.log(`${TAG} Full-screen notification launched app:`, data);
      if (callback) {
        callback(data);
      }
    });
    console.log(`${TAG} Launch listener added`);
  } catch (error) {
    console.error(`${TAG} Error adding launch listener:`, error);
  }
};

/**
 * Initialize full-screen notification system
 */
export const initialize = async () => {
  console.log(`${TAG} Initializing...`);
  
  if (!isNative()) {
    console.log(`${TAG} Not on native platform`);
    return { initialized: false, reason: 'not_native' };
  }
  
  try {
    // Check permission status
    const permStatus = await checkPermission();
    
    if (!permStatus.granted) {
      console.log(`${TAG} Permission not granted, requesting...`);
      const requestResult = await requestPermission();
      
      if (!requestResult.granted) {
        console.warn(`${TAG} Permission denied - full-screen intents may not work`);
        return { initialized: false, reason: 'permission_denied' };
      }
    }
    
    console.log(`${TAG} Initialization complete`);
    return { initialized: true };
  } catch (error) {
    console.error(`${TAG} Initialization error:`, error);
    // Even if there's an error (plugin might not support all methods),
    // return true as the basic functionality might still work
    return { initialized: true, warning: error.message };
  }
};

export default {
  isNative,
  initialize,
  checkPermission,
  requestPermission,
  showFullScreen,
  schedule,
  addLaunchListener
};
