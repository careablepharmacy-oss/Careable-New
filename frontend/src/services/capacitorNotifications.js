import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import fullScreenNotification from './fullScreenNotification';

/**
 * Capacitor Local Notifications Service
 * Replaces web push notifications with native local notifications
 */

class CapacitorNotificationService {
  constructor() {
    this.isNative = Capacitor.isNativePlatform();
    this.permissionGranted = false;
  }

  /**
   * Check if running on native platform (Android/iOS)
   */
  isNativePlatform() {
    return this.isNative;
  }

  /**
   * Request notification permissions
   */
  getChannelId(urgency) {
    // All notifications now use alarm channel
    return 'alarm_reminders';
  }

  async requestPermissions() {
    try {
      console.log('[CapacitorNotifications] Checking platform...');
      console.log('[CapacitorNotifications] isNative:', this.isNative);
      console.log('[CapacitorNotifications] Capacitor available:', typeof Capacitor !== 'undefined');
      console.log('[CapacitorNotifications] LocalNotifications available:', typeof LocalNotifications !== 'undefined');
      
      if (!this.isNative) {
        console.log('[CapacitorNotifications] Not on native platform, skipping Capacitor notifications');
        return false;
      }

      console.log('[CapacitorNotifications] Checking current permissions...');
      const result = await LocalNotifications.checkPermissions();
      console.log('[CapacitorNotifications] Current permissions:', result);
      
      if (result.display !== 'granted') {
        console.log('[CapacitorNotifications] Requesting permissions...');
        const request = await LocalNotifications.requestPermissions();
        console.log('[CapacitorNotifications] Permission request result:', request);
        this.permissionGranted = request.display === 'granted';
      } else {
        console.log('[CapacitorNotifications] Permissions already granted');
        this.permissionGranted = true;
      }

      // CRITICAL for Android 12+: Check SCHEDULE_EXACT_ALARM permission
      console.log('[CapacitorNotifications] Checking exact notification setting (Android 12+)...');
      try {
        const exactSetting = await LocalNotifications.checkExactNotificationSetting();
        console.log('[CapacitorNotifications] Exact notification setting:', exactSetting);
        
        if (exactSetting && exactSetting.exact === 'denied') {
          console.warn('[CapacitorNotifications] ⚠️ SCHEDULE_EXACT_ALARM not granted!');
          console.log('[CapacitorNotifications] Requesting exact alarm permission...');
          
          // Request user to grant exact alarm permission
          await LocalNotifications.changeExactNotificationSetting();
          console.log('[CapacitorNotifications] User redirected to settings for exact alarm permission');
        } else if (exactSetting && exactSetting.exact === 'granted') {
          console.log('[CapacitorNotifications] ✅ Exact alarm permission granted');
        } else {
          console.log('[CapacitorNotifications] Exact alarm setting:', exactSetting);
        }
      } catch (error) {
        console.log('[CapacitorNotifications] checkExactNotificationSetting not available (Android < 12 or older Capacitor version)');
        console.log('[CapacitorNotifications] This is OK on Android < 12');
      }

      console.log('[CapacitorNotifications] ✅ Final permission status:', this.permissionGranted);
      return this.permissionGranted;
    } catch (error) {
      console.error('[CapacitorNotifications] ❌ Error requesting notification permissions:', error);
      console.error('[CapacitorNotifications] Error details:', error.message, error.stack);
      return false;
    }
  }

  /**
   * Schedule medication reminder notifications
   * @param {Object} medication - Medication object with schedule
   * @param {Array} reminderTimes - Array of reminder time objects
   */
  async scheduleMedicationReminders(medication, reminderTimes) {
    try {
      console.log('[CapacitorNotifications] scheduleMedicationReminders called');
      console.log('[CapacitorNotifications] isNative:', this.isNative);
      console.log('[CapacitorNotifications] permissionGranted:', this.permissionGranted);
      console.log('[CapacitorNotifications] reminderTimes:', reminderTimes);
      
      if (!this.isNative) {
        console.log('[CapacitorNotifications] ❌ Not on native platform');
        return false;
      }
      
      if (!this.permissionGranted) {
        console.log('[CapacitorNotifications] ⚠️ Permissions not granted, requesting now...');
        const granted = await this.requestPermissions();
        if (!granted) {
          console.log('[CapacitorNotifications] ❌ Permission request failed');
          return false;
        }
      }

      const notifications = reminderTimes.map((reminder, index) => {
        const triggerDate = new Date(reminder.trigger_time);
        
        console.log('[CapacitorNotifications] ===== Creating Notification ', index + 1, '=====');
        console.log('[CapacitorNotifications] Reminder:', reminder);
        console.log('[CapacitorNotifications] Trigger time string:', reminder.trigger_time);
        console.log('[CapacitorNotifications] Trigger Date object:', triggerDate);
        console.log('[CapacitorNotifications] Trigger Date ISO:', triggerDate.toISOString());
        console.log('[CapacitorNotifications] Trigger Date ms:', triggerDate.getTime());
        console.log('[CapacitorNotifications] Current time ms:', Date.now());
        console.log('[CapacitorNotifications] Is in future?', triggerDate.getTime() > Date.now());
        
        // Vibration patterns based on urgency
        // CRITICAL: Very strong, long repeating vibration pattern for alarm
        // Pattern: [delay, vibrate, pause] repeated multiple times
        // Total ~10 seconds of STRONG vibration
        const alarmVibrationPattern = [0, 1000, 500, 1000, 500, 1000, 500, 1000, 500, 1000, 500, 1000, 500, 1000, 500];
        
        // Simple numeric ID generation - use index to ensure uniqueness
        const notifId = parseInt(medication.id.replace(/\D/g, '').slice(-6) + index) || (Date.now() % 1000000);
        
        console.log('[CapacitorNotifications] Reminder ID:', reminder.id);
        console.log('[CapacitorNotifications] Medication ID:', medication.id);
        console.log('[CapacitorNotifications] Index:', index);
        console.log('[CapacitorNotifications] ✅ Generated notification ID:', notifId);

        const notificationPayload = {
          id: notifId,
          title: reminder.title,
          body: reminder.message,
          schedule: {
            at: triggerDate,
            allowWhileIdle: true,
            // Force exact timing on Android
            exact: true
          },
          // CRITICAL: Sound is handled by notification channel (uses ALARM audio stream)
          // The channel is configured with default alarm ringtone which is loud and looping
          sound: null, // null = use channel's sound (alarm ringtone)
          smallIcon: 'ic_stat_icon_config_sample',
          iconColor: '#FF0000', // Red for alarm
          channelId: 'alarm_reminders', // Dedicated alarm channel with custom sound
          // Make notification act like an alarm
          ongoing: true, // Cannot be dismissed by swipe
          autoCancel: false, // Stays until user interacts
          // CRITICAL: Add full screen intent for alarm-like behavior
          fullScreenIntent: true,
          extra: {
            medicationId: medication.id,
            reminderType: reminder.type,
            urgency: 'alarm',
            vibrationPattern: alarmVibrationPattern
          }
        };
        
        console.log('[CapacitorNotifications] Full payload:', JSON.stringify(notificationPayload, (key, value) => {
          if (value instanceof Date) return value.toISOString();
          return value;
        }, 2));
        
        return notificationPayload;
      });

      console.log('[CapacitorNotifications] ====== SCHEDULING NOTIFICATIONS ======');
      console.log('[CapacitorNotifications] Total to schedule:', notifications.length);
      
      // Schedule regular local notifications
      await LocalNotifications.schedule({ notifications });
      
      console.log('[CapacitorNotifications] ✅ Regular notifications scheduled');
      
      // ADDITIONALLY: Schedule full-screen notification for alarm effect
      // This will wake the device and show over lock screen
      console.log('[CapacitorNotifications] ====== SCHEDULING FULL-SCREEN NOTIFICATION ======');
      
      if (reminderTimes.length > 0) {
        const firstReminder = reminderTimes[0];
        const triggerDate = new Date(firstReminder.trigger_time);
        
        try {
          await fullScreenNotification.schedule({
            id: parseInt(medication.id.replace(/\D/g, '').slice(-6)) || Date.now(),
            title: firstReminder.title,
            body: firstReminder.message,
            scheduleAt: triggerDate.getTime()
          });
          console.log('[CapacitorNotifications] ✅ Full-screen notification scheduled');
        } catch (error) {
          console.warn('[CapacitorNotifications] ⚠️ Full-screen notification failed (may not be supported):', error);
          // Continue anyway - regular notification will still work
        }
      }
      
      console.log(`[CapacitorNotifications] ✅ All notifications scheduled for ${medication.name}`);
      
      // Verify they were scheduled
      const pending = await LocalNotifications.getPending();
      console.log('[CapacitorNotifications] Pending notifications after schedule:', pending.notifications.length);
      
      return true;
    } catch (error) {
      console.error('Error scheduling medication reminders:', error);
      return false;
    }
  }

  /**
   * Schedule appointment reminder
   * @param {Object} appointment - Appointment object
   * @param {Array} reminderTimes - Array of reminder time objects
   */
  async scheduleAppointmentReminders(appointment, reminderTimes) {
    try {
      if (!this.isNative || !this.permissionGranted) {
        return false;
      }

      const notifications = reminderTimes.map((reminder) => {
        const triggerDate = new Date(reminder.trigger_time);
        
        return {
          id: parseInt(reminder.id.replace(/\D/g, '').slice(-8)) || Math.floor(Math.random() * 1000000),
          title: reminder.title,
          body: reminder.message,
          schedule: {
            at: triggerDate,
            allowWhileIdle: true
          },
          sound: 'beep.wav',
          smallIcon: 'ic_stat_icon_config_sample',
          iconColor: '#2BA89F',
          extra: {
            appointmentId: appointment.id,
            reminderType: reminder.type,
            urgency: 'normal'
          }
        };
      });

      await LocalNotifications.schedule({ notifications });
      console.log(`Scheduled ${notifications.length} reminders for appointment: ${appointment.title}`);
      return true;
    } catch (error) {
      console.error('Error scheduling appointment reminders:', error);
      return false;
    }
  }

  /**
   * Cancel all scheduled notifications
   */
  async cancelAllNotifications() {
    try {
      if (!this.isNative) return false;
      
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length > 0) {
        await LocalNotifications.cancel({ 
          notifications: pending.notifications 
        });
        console.log(`Cancelled ${pending.notifications.length} notifications`);
      }
      return true;
    } catch (error) {
      console.error('Error cancelling notifications:', error);
      return false;
    }
  }

  /**
   * Cancel specific medication reminders
   * @param {string} medicationId - Medication ID
   */
  async cancelMedicationReminders(medicationId) {
    try {
      if (!this.isNative) return false;
      
      const pending = await LocalNotifications.getPending();
      const toCancel = pending.notifications.filter(
        n => n.extra?.medicationId === medicationId
      );
      
      if (toCancel.length > 0) {
        await LocalNotifications.cancel({ notifications: toCancel });
        console.log(`Cancelled ${toCancel.length} reminders for medication ${medicationId}`);
      }
      return true;
    } catch (error) {
      console.error('Error cancelling medication reminders:', error);
      return false;
    }
  }

  /**
   * Get all pending notifications
   */
  async getPendingNotifications() {
    try {
      if (!this.isNative) return [];
      
      const result = await LocalNotifications.getPending();
      return result.notifications;
    } catch (error) {
      console.error('Error getting pending notifications:', error);
      return [];
    }
  }

  /**
   * Register notification action handlers
   */
  registerActionHandlers(onNotificationReceived, onNotificationAction) {
    if (!this.isNative) return;

    // Listen for notification received while app is in foreground
    LocalNotifications.addListener('localNotificationReceived', (notification) => {
      console.log('Notification received:', notification);
      if (onNotificationReceived) {
        onNotificationReceived(notification);
      }
    });

    // Listen for notification action (user tapped notification)
    LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
      console.log('Notification action:', action);
      if (onNotificationAction) {
        onNotificationAction(action);
      }
    });
  }

  /**
   * Remove all listeners
   */
  removeAllListeners() {
    if (!this.isNative) return;
    
    LocalNotifications.removeAllListeners();
  }
}

// Export singleton instance
const capacitorNotificationService = new CapacitorNotificationService();
export default capacitorNotificationService;
