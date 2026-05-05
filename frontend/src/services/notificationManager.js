/**
 * Unified Notification Manager
 * Handles both web push notifications (PWA) and native notifications (Capacitor)
 * Automatically detects platform and uses appropriate method
 */

import capacitorNotificationService from './capacitorNotifications';
import nativeAlarmsService from './nativeAlarms';
import apiService from './api';

// Scheduling configuration - change based on environment
const SCHEDULING_CONFIG = {
  testing: {
    SCHEDULE_AHEAD_MINUTES: 5,  // Schedule 5 minutes ahead for testing
    RESCHEDULE_THRESHOLD_MINUTES: 1.5,  // Re-schedule when < 1.5 min left
    ALARM_INTERVAL_MINUTES: 2  // Alarms every 2 minutes in testing
  },
  production: {
    SCHEDULE_AHEAD_DAYS: 7,  // Schedule 7 days ahead (reschedules on every app launch)
    RESCHEDULE_THRESHOLD_DAYS: 2,  // Re-schedule when < 2 days left
    ALARM_INTERVAL_HOURS: 24,  // Alarms every 24 hours (daily)
    MAX_TOTAL_NOTIFICATIONS: 400  // Hard cap to stay under Android's 500 limit
  }
};

// Toggle between testing and production mode
// Set to 'testing' for quick validation, 'production' for real use
const CURRENT_ENV = 'production';  // PRODUCTION BUILD - 90 days scheduling
const CONFIG = SCHEDULING_CONFIG[CURRENT_ENV];

console.log(`[NotificationManager] Environment: ${CURRENT_ENV}`);
console.log('[NotificationManager] Config:', CONFIG);

class NotificationManager {
  constructor() {
    this.isNative = capacitorNotificationService.isNativePlatform();
    this.permissionsGranted = false;
    this.environment = CURRENT_ENV;
  }

  /**
   * Check if alarms are running low and re-schedule if needed
   */
  async checkAndRescheduleIfNeeded() {
    console.log('[NotificationManager] Checking alarm count...');
    
    try {
      const pending = await capacitorNotificationService.getPendingNotifications();
      const pendingCount = pending.notifications?.length || 0;
      
      console.log(`[NotificationManager] Pending alarms: ${pendingCount}`);
      
      // Calculate threshold based on environment
      let threshold;
      if (this.environment === 'testing') {
        // In testing: threshold in milliseconds
        threshold = CONFIG.RESCHEDULE_THRESHOLD_MINUTES * 60 * 1000;
      } else {
        // In production: threshold in milliseconds
        threshold = CONFIG.RESCHEDULE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;
      }
      
      const now = Date.now();
      const alarmsWithinThreshold = (pending.notifications || []).filter(n => {
        const scheduleTime = new Date(n.schedule.at).getTime();
        return (scheduleTime - now) < threshold;
      });
      
      console.log(`[NotificationManager] Alarms within threshold: ${alarmsWithinThreshold.length}`);
      
      // If low on alarms, re-schedule
      if (pendingCount < 3 || alarmsWithinThreshold.length === pendingCount) {
        console.log('[NotificationManager] ⚠️ LOW ALARMS DETECTED - RE-SCHEDULING...');
        
        // Cancel all existing notifications before rescheduling to prevent accumulation
        try {
          const { LocalNotifications } = await import('@capacitor/local-notifications');
          await LocalNotifications.removeAllDeliveredNotifications();
          // Cancel all pending to start fresh
          if (pendingCount > 0) {
            const ids = (pending.notifications || []).map(n => ({ id: n.id }));
            if (ids.length > 0) {
              await LocalNotifications.cancel({ notifications: ids });
              console.log(`[NotificationManager] Cancelled ${ids.length} existing notifications`);
            }
          }
        } catch (cancelErr) {
          console.warn('[NotificationManager] Error cancelling old notifications:', cancelErr);
        }
        
        // Get all active medications and re-schedule them
        const medications = await apiService.getMedications();
        const activeMedications = medications.filter(m => {
          if (!m.schedule) return false;
          // Support both dosage_timings (new) and times (legacy)
          const hasDosageTimings = m.schedule.dosage_timings && m.schedule.dosage_timings.length > 0;
          const hasTimes = m.schedule.times && m.schedule.times.length > 0;
          return hasDosageTimings || hasTimes;
        });
        
        console.log(`[NotificationManager] Re-scheduling for ${activeMedications.length} medications`);
        
        // Track total notifications across all medications
        let totalScheduled = 0;
        const maxTotal = CONFIG.MAX_TOTAL_NOTIFICATIONS || 400;
        
        for (const med of activeMedications) {
          if (totalScheduled >= maxTotal) {
            console.warn(`[NotificationManager] Global cap reached (${maxTotal}), stopping`);
            break;
          }
          await this.scheduleMedicationBatch(med);
          totalScheduled += (med.schedule.times?.length || med.schedule.dosage_timings?.length || 1) * (CONFIG.SCHEDULE_AHEAD_DAYS || 7);
        }
        
        console.log('[NotificationManager] ✅ Re-scheduling complete');
        return true;
      } else {
        console.log('[NotificationManager] ✅ Alarm count is healthy');
        return false;
      }
      
    } catch (error) {
      console.error('[NotificationManager] Error checking/rescheduling:', error);
      return false;
    }
  }

  /**
   * Re-schedule all medication alarms
   * Called when user re-enables local alarms
   */
  async rescheduleAllMedications() {
    try {
      console.log('[NotificationManager] Re-scheduling all medication alarms...');
      
      // Cancel all existing notifications first to prevent accumulation
      try {
        const { LocalNotifications } = await import('@capacitor/local-notifications');
        const pending = await LocalNotifications.getPending();
        if (pending.notifications && pending.notifications.length > 0) {
          const ids = pending.notifications.map(n => ({ id: n.id }));
          await LocalNotifications.cancel({ notifications: ids });
          console.log(`[NotificationManager] Cancelled ${ids.length} existing notifications`);
        }
      } catch (cancelErr) {
        console.warn('[NotificationManager] Error cancelling old notifications:', cancelErr);
      }
      
      // Get all active medications
      const medications = await apiService.getMedications();
      const activeMedications = medications.filter(m => m.schedule && (m.schedule.times || m.schedule.dosage_timings));
      
      console.log(`[NotificationManager] Found ${activeMedications.length} active medications`);
      
      if (activeMedications.length === 0) {
        console.log('[NotificationManager] No medications to schedule');
        return true;
      }
      
      // Schedule alarms for each medication
      for (const med of activeMedications) {
        await this.scheduleMedicationBatch(med);
      }
      
      console.log('[NotificationManager] ✅ Re-scheduling complete');
      return true;
    } catch (error) {
      console.error('[NotificationManager] Error re-scheduling medications:', error);
      throw error;
    }
  }

  /**
   * Check if local alarms are enabled
   */
  async areLocalAlarmsEnabled() {
    try {
      const setting = await import('./storageService').then(m => m.default.getItem('local_alarms_enabled'));
      // Default to false (alarm is opt-in)
      return setting === null ? false : setting === 'true';
    } catch (error) {
      console.error('[NotificationManager] Error checking local alarms setting:', error);
      return false; // Default to disabled
    }
  }

  /**
   * Initialize notification system
   * Requests permissions and sets up listeners
   */
  async initialize() {
    try {
      if (this.isNative) {
        // Native platform - use Capacitor LocalNotifications (THE WORKING SYSTEM)
        console.log('[NotificationManager] Initializing Capacitor notifications...');
        this.permissionsGranted = await capacitorNotificationService.requestPermissions();
        
        if (this.permissionsGranted) {
          console.log('[NotificationManager] Notification permissions granted');
          
          // Check if local alarms are enabled before scheduling
          const localAlarmsEnabled = await this.areLocalAlarmsEnabled();
          
          if (localAlarmsEnabled) {
            // Check if we need to re-schedule alarms (runs in background)
            setTimeout(() => {
              this.checkAndRescheduleIfNeeded().catch(err => {
                console.error('[NotificationManager] Background re-schedule check failed:', err);
              });
            }, 2000);  // Wait 2 seconds after init
          } else {
            console.log('[NotificationManager] Local alarms are disabled by user - skipping scheduling');
          }
        } else {
          console.error('[NotificationManager] Notification permissions denied');
        }
      } else {
        // Web platform - use existing web push
        console.log('Initializing web push notifications...');
        this.permissionsGranted = await this.requestWebPushPermissions();
      }

      return this.permissionsGranted;
    } catch (error) {
      console.error('Error initializing notifications:', error);
      return false;
    }
  }

  /**
   * Request web push permissions (existing PWA logic)
   */
  async requestWebPushPermissions() {
    try {
      if (!('Notification' in window)) {
        console.log('This browser does not support notifications');
        return false;
      }

      if (Notification.permission === 'granted') {
        return true;
      }

      if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
      }

      return false;
    } catch (error) {
      console.error('Error requesting web push permissions:', error);
      return false;
    }
  }

  /**
   * Subscribe to push notifications (web) or enable notifications (native)
   */
  async enableNotifications() {
    try {
      if (this.isNative) {
        // Native - just ensure permissions are granted
        if (!this.permissionsGranted) {
          this.permissionsGranted = await capacitorNotificationService.requestPermissions();
        }
        return this.permissionsGranted;
      } else {
        // Web - subscribe to push notifications
        if (!this.permissionsGranted) {
          this.permissionsGranted = await this.requestWebPushPermissions();
        }

        if (this.permissionsGranted) {
          // Get VAPID public key and subscribe
          const vapidPublicKey = await apiService.getVapidPublicKey();
          
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: this.urlBase64ToUint8Array(vapidPublicKey)
          });

          // Send subscription to backend
          await apiService.subscribeToPushNotifications(subscription);
          return true;
        }
        return false;
      }
    } catch (error) {
      console.error('Error enabling notifications:', error);
      return false;
    }
  }

  /**
   * Schedule medication reminders
   * Fetches schedule from backend and creates local notifications
   */
  async scheduleMedicationReminders(medication) {
    try {
      if (this.isNative) {
        // Check if local alarms are enabled
        const localAlarmsEnabled = await this.areLocalAlarmsEnabled();
        if (!localAlarmsEnabled) {
          console.log('[NotificationManager] Local alarms disabled - skipping scheduling for:', medication.name);
          return true; // Return success but don't schedule
        }
        
        // Native - schedule ALARM notifications using Capacitor (THE WORKING SYSTEM)
        console.log('[NotificationManager] Scheduling ALARM notifications for:', medication.name);
        
        // Schedule alarms for the configured period ahead (90 days production, 5 min testing)
        console.log('[NotificationManager] Scheduling alarms using batch one-time approach');
        await this.scheduleMedicationBatch(medication);
        console.log(`[NotificationManager] ✅ Scheduled batch alarms for ${medication.name}`);
        
        return true;
      } else {
        // Web - reminders handled by backend push system
        console.log('[NotificationManager] Web push - reminders handled by backend');
        return true;
      }
    } catch (error) {
      console.error('[NotificationManager] ❌ Error scheduling medication reminders:', error);
      return false;
    }
  }

  /**
   * Schedule a batch of one-time alarms for the medication
   * Based on environment: 5 minutes ahead (testing) or 90 days ahead (production)
   */
  async scheduleMedicationBatch(medication) {
    console.log('[NotificationManager] ========== SCHEDULING BATCH ==========');
    console.log('[NotificationManager] Environment:', this.environment);
    console.log('[NotificationManager] Medication:', medication.name);
    console.log('[NotificationManager] Frequency:', medication.schedule.frequency);
    
    const notifications = [];
    const now = new Date();
    console.log('[NotificationManager] Current device time:', now.toString());
    console.log('[NotificationManager] Timezone offset (minutes):', now.getTimezoneOffset());
    
    // Calculate end time based on environment
    let endTime;
    if (this.environment === 'testing') {
      endTime = new Date(now.getTime() + CONFIG.SCHEDULE_AHEAD_MINUTES * 60 * 1000);
      console.log('[NotificationManager] Testing mode: scheduling', CONFIG.SCHEDULE_AHEAD_MINUTES, 'minutes ahead');
    } else {
      endTime = new Date(now.getTime() + CONFIG.SCHEDULE_AHEAD_DAYS * 24 * 60 * 60 * 1000);
      console.log('[NotificationManager] Production mode: scheduling', CONFIG.SCHEDULE_AHEAD_DAYS, 'days ahead');
    }
    
    console.log('[NotificationManager] End time:', endTime.toISOString());
    
    // Get medication times - support both dosage_timings (new) and times (legacy)
    let times = medication.schedule.times || [];
    if (times.length === 0 && medication.schedule.dosage_timings && medication.schedule.dosage_timings.length > 0) {
      times = medication.schedule.dosage_timings.map(dt => dt.time).filter(Boolean);
    }
    if (times.length === 0) {
      console.error('[NotificationManager] No times configured for medication');
      return;
    }
    
    console.log('[NotificationManager] Times per day:', times);
    
    // Generate alarms
    let alarmCount = 0;
    
    if (this.environment === 'testing') {
      // TESTING MODE: Schedule at intervals starting from NOW
      console.log('[NotificationManager] Testing mode: scheduling at 2-minute intervals from now');
      
      let alarmTime = new Date(now.getTime() + 2 * 60 * 1000); // Start 2 minutes from now
      
      while (alarmTime <= endTime) {
        console.log(`[NotificationManager] Creating alarm ${alarmCount + 1}:`, alarmTime.toString());
        console.log(`[NotificationManager] Alarm ISO:`, alarmTime.toISOString());
        
        const notification = {
          id: this.generateNotificationId(medication.id, alarmTime),
          title: `Time to take ${medication.name}`,
          body: `${medication.dosage || 'Take your medication'}`,
          schedule: { at: alarmTime },
          channelId: 'medication_alarm_v2',
          extra: {
            medicationId: medication.id,
            medicationName: medication.name,
            scheduledTime: alarmTime.toISOString()
          }
        };
        
        notifications.push(notification);
        alarmCount++;
        
        // Next alarm in 2 minutes
        alarmTime = new Date(alarmTime.getTime() + CONFIG.ALARM_INTERVAL_MINUTES * 60 * 1000);
      }
      
    } else {
      // PRODUCTION MODE: Schedule at actual medication times for multiple days
      console.log('[NotificationManager] Production mode: scheduling at medication times');
      
      let currentDate = new Date(now);
      
      while (currentDate <= endTime) {
        // Check if we should schedule for this day based on frequency
        const shouldSchedule = this.shouldScheduleForDay(medication, currentDate);
        
        if (shouldSchedule) {
          for (const timeStr of times) {
            const [hours, minutes] = timeStr.split(':').map(Number);
            const alarmTime = new Date(currentDate);
            alarmTime.setHours(hours, minutes, 0, 0);
            
            // Only schedule future alarms
            if (alarmTime > now) {
            const notification = {
              id: this.generateNotificationId(medication.id, alarmTime),
              title: `Time to take ${medication.name}`,
              body: `${medication.dosage || 'Take your medication'}`,
              schedule: { at: alarmTime },
              channelId: 'medication_alarm_v2',
              extra: {
                medicationId: medication.id,
                medicationName: medication.name,
                scheduledTime: alarmTime.toISOString()
              }
            };
            
              notifications.push(notification);
              alarmCount++;
              
              if (alarmCount <= 3) {
                console.log(`[NotificationManager] Alarm ${alarmCount}:`, alarmTime.toISOString());
              }
            }
          }
        }
        
        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }
    
    console.log(`[NotificationManager] Total alarms to schedule: ${alarmCount}`);
    
    if (notifications.length > 0) {
      // Apply global cap to prevent exceeding Android's 500 exact alarm limit
      const maxNotifs = CONFIG.MAX_TOTAL_NOTIFICATIONS || 400;
      if (notifications.length > maxNotifs) {
        console.warn(`[NotificationManager] Capping notifications from ${notifications.length} to ${maxNotifs}`);
        notifications.length = maxNotifs;
      }

      try {
        // Import LocalNotifications from Capacitor
        const { LocalNotifications } = await import('@capacitor/local-notifications');
        
        // Schedule in batches to avoid overwhelming the system
        const BATCH_SIZE = 50;
        for (let i = 0; i < notifications.length; i += BATCH_SIZE) {
          const batch = notifications.slice(i, i + BATCH_SIZE);
          try {
            await LocalNotifications.schedule({ notifications: batch });
            console.log(`[NotificationManager] Scheduled batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} alarms)`);
          } catch (batchErr) {
            console.error(`[NotificationManager] Failed to schedule batch ${Math.floor(i / BATCH_SIZE) + 1}:`, batchErr);
            // Stop scheduling if we hit an error (likely alarm limit)
            break;
          }
        }
        console.log(`[NotificationManager] ✅ Successfully scheduled ${notifications.length} total alarms`);
      } catch (err) {
        console.error('[NotificationManager] Failed to schedule notifications:', err);
      }
    }
  }

  /**
   * Check if medication should be scheduled for a given day
   */
  shouldScheduleForDay(medication, date) {
    const frequency = medication.schedule.frequency;
    
    if (frequency === 'daily') {
      return true;
    }
    
    if (frequency === 'weekly') {
      const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase();
      const weeklyDays = medication.schedule.weekly_days || [];
      return weeklyDays.includes(dayOfWeek);
    }
    
    // For other frequencies, default to true
    return true;
  }

  /**
   * Generate a unique notification ID that fits in Java int (max: 2,147,483,647)
   */
  generateNotificationId(medicationId, date) {
    // Get last 6 chars of medication ID for uniqueness
    const medHash = medicationId.split('-').join('').substring(0, 6);
    const medNumber = parseInt(medHash, 16) % 100000; // Keep it under 100k
    
    // Use minutes since epoch for time component (smaller number)
    const minutesSinceEpoch = Math.floor(date.getTime() / 60000) % 1000000; // Keep under 1 million
    
    // Combine: medication (up to 100k) + time (up to 1M) = max ~1.1M (well within Java int)
    const id = medNumber * 10000 + (minutesSinceEpoch % 10000);
    
    console.log(`[NotificationManager] Generated ID: ${id} for ${medicationId.substring(0, 8)}... at ${date.toISOString()}`);
    return id;
  }

  /**
   * Calculate reminder times for a medication (local calculation)
   * SIMPLIFIED: Only ONE notification per medication time
   * Updated to handle both daily and weekly schedules
   */
  calculateMedicationReminders(medication) {
    const reminders = [];
    
    console.log('[NotificationManager] ========== CALCULATING REMINDERS ==========');
    console.log('[NotificationManager] Medication:', medication);
    console.log('[NotificationManager] Schedule:', medication.schedule);
    console.log('[NotificationManager] Times array:', medication.schedule?.times);
    console.log('[NotificationManager] Frequency:', medication.schedule?.frequency);
    console.log('[NotificationManager] Weekly days:', medication.schedule?.weekly_days);
    
    // Safety check - ensure times array exists
    if (!medication.schedule || !medication.schedule.times || medication.schedule.times.length === 0) {
      console.error('[NotificationManager] ❌ No times in schedule!');
      return [];
    }

    // For weekly, check if days are selected
    if (medication.schedule.frequency === 'weekly' && 
        (!medication.schedule.weekly_days || medication.schedule.weekly_days.length === 0)) {
      console.error('[NotificationManager] ❌ No days selected for weekly schedule!');
      return [];
    }
    
    // Work entirely with timestamps (milliseconds)
    const nowUTC_ms = Date.now();
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // 5 hours 30 minutes in milliseconds
    const nowIST_ms = nowUTC_ms + IST_OFFSET_MS;
    
    console.log('[NotificationManager] Current UTC:', new Date(nowUTC_ms).toISOString());
    console.log('[NotificationManager] Current IST:', new Date(nowIST_ms).toISOString());
    
    medication.schedule.times.forEach((time, index) => {
      console.log('[NotificationManager] -----');
      console.log('[NotificationManager] Processing time:', time);
      const [hours, minutes] = time.split(':');
      
      let finalUTC_ms;
      
      if (medication.schedule.frequency === 'weekly') {
        // For weekly, find the next occurrence based on selected days
        finalUTC_ms = this.getNextWeeklyOccurrence(
          medication.schedule.weekly_days,
          hours,
          minutes,
          nowIST_ms,
          IST_OFFSET_MS
        );
      } else {
        // For daily, calculate next occurrence (today or tomorrow)
        const todayIST_date = new Date(nowIST_ms);
        todayIST_date.setUTCHours(0, 0, 0, 0);
        const todayMidnightIST_ms = todayIST_date.getTime();
        
        const hoursInMs = parseInt(hours) * 60 * 60 * 1000;
        const minutesInMs = parseInt(minutes) * 60 * 1000;
        const medTimeIST_ms = todayMidnightIST_ms + hoursInMs + minutesInMs;
        
        let finalMedTimeIST_ms = medTimeIST_ms;
        if (medTimeIST_ms <= nowIST_ms) {
          console.log('[NotificationManager] ⚠️ Time already passed today, scheduling for tomorrow');
          finalMedTimeIST_ms = medTimeIST_ms + (24 * 60 * 60 * 1000);
        }
        
        finalUTC_ms = finalMedTimeIST_ms - IST_OFFSET_MS;
      }
      
      const finalUTC = new Date(finalUTC_ms);
      
      console.log('[NotificationManager] ═══════════════════════════');
      console.log('[NotificationManager] FINAL NOTIFICATION TIME:');
      console.log('[NotificationManager] UTC (for Capacitor):', finalUTC.toISOString());
      console.log('[NotificationManager] Minutes from now:', Math.round((finalUTC_ms - nowUTC_ms) / 60000), 'minutes');
      console.log('[NotificationManager] ═══════════════════════════');
      
      // Create alarm notification with metadata for rescheduling
      reminders.push({
        id: `${medication.id}-${index}`,
        trigger_time: finalUTC.toISOString(),
        title: '⏰ Medication Alarm',
        message: `Time to take ${medication.name} (${time} IST)`,
        urgency: 'alarm',
        type: 'medication',
        // Add metadata for native rescheduling
        metadata: {
          medicationId: medication.id,
          medicationName: medication.name,
          frequency: medication.schedule.frequency,
          time: time,
          weeklyDays: medication.schedule.weekly_days || [],
          endDate: medication.schedule.end_date || null
        }
      });
      console.log('[NotificationManager] ✅ Created alarm notification for:', finalUTC.toISOString());
    });

    console.log('[NotificationManager] Total reminders calculated:', reminders.length);
    console.log('[NotificationManager] Reminder details:', reminders);
    return reminders;
  }

  /**
   * Get next weekly occurrence based on selected days
   */
  getNextWeeklyOccurrence(weeklyDays, hours, minutes, nowIST_ms, IST_OFFSET_MS) {
    const dayMap = {
      'sunday': 0,
      'monday': 1,
      'tuesday': 2,
      'wednesday': 3,
      'thursday': 4,
      'friday': 5,
      'saturday': 6
    };

    const currentDate = new Date(nowIST_ms);
    const currentDay = currentDate.getUTCDay(); // 0=Sunday, 6=Saturday
    
    // Convert selected days to numbers
    const selectedDayNumbers = weeklyDays.map(day => dayMap[day.toLowerCase()]).sort((a, b) => a - b);
    
    console.log('[NotificationManager] Current day (IST):', currentDay, '(0=Sun, 6=Sat)');
    console.log('[NotificationManager] Selected days:', selectedDayNumbers);
    
    // Find next occurrence
    let daysUntilNext = null;
    
    // First check today
    const todayIST_date = new Date(nowIST_ms);
    todayIST_date.setUTCHours(0, 0, 0, 0);
    const todayMidnightIST_ms = todayIST_date.getTime();
    
    const hoursInMs = parseInt(hours) * 60 * 60 * 1000;
    const minutesInMs = parseInt(minutes) * 60 * 1000;
    const medTimeToday_ms = todayMidnightIST_ms + hoursInMs + minutesInMs;
    
    if (selectedDayNumbers.includes(currentDay) && medTimeToday_ms > nowIST_ms) {
      // Today is a selected day and time hasn't passed
      daysUntilNext = 0;
    } else {
      // Find next selected day
      for (let i = 1; i <= 7; i++) {
        const checkDay = (currentDay + i) % 7;
        if (selectedDayNumbers.includes(checkDay)) {
          daysUntilNext = i;
          break;
        }
      }
    }
    
    console.log('[NotificationManager] Days until next occurrence:', daysUntilNext);
    
    const nextOccurrenceIST_ms = todayMidnightIST_ms + (daysUntilNext * 24 * 60 * 60 * 1000) + hoursInMs + minutesInMs;
    const nextOccurrenceUTC_ms = nextOccurrenceIST_ms - IST_OFFSET_MS;
    
    console.log('[NotificationManager] Next weekly occurrence (IST):', new Date(nextOccurrenceIST_ms).toISOString());
    
    return nextOccurrenceUTC_ms;
  }

  /**
   * Cancel medication reminders
   */
  async cancelMedicationReminders(medicationId) {
    try {
      if (this.isNative) {
        console.log(`[NotificationManager] Cancelling reminders for medication ${medicationId}`);
        
        const { LocalNotifications } = await import('@capacitor/local-notifications');
        const pending = await LocalNotifications.getPending();
        
        const toCancel = pending.notifications.filter(
          n => n.extra?.medicationId === medicationId
        );
        
        if (toCancel.length > 0) {
          await LocalNotifications.cancel({ notifications: toCancel });
          console.log(`[NotificationManager] Cancelled ${toCancel.length} reminders for medication ${medicationId}`);
        } else {
          console.log(`[NotificationManager] No pending reminders found for medication ${medicationId}`);
        }
        
        return true;
      } else {
        // Web - reminders managed by backend push notifications
        console.log('[NotificationManager] Web push - cancellation handled by backend');
        return true;
      }
    } catch (error) {
      console.error('[NotificationManager] Error cancelling medication reminders:', error);
      return false;
    }
  }

  /**
   * Get pending notifications
   */
  async getPendingNotifications() {
    try {
      if (this.isNative) {
        // Note: Our custom native alarms don't have a getPending method yet
        // This would require additional Android implementation
        console.log('[NotificationManager] getPending not implemented for native alarms');
        return [];
      } else {
        // Web - get from backend
        const status = await apiService.getReminderStatus();
        return status.reminder_stats || {};
      }
    } catch (error) {
      console.error('Error getting pending notifications:', error);
      return [];
    }
  }

  /**
   * Handle notification received (foreground)
   */
  handleNotificationReceived(notification) {
    console.log('Notification received in foreground:', notification);
    // You can show a toast or update UI here
  }

  /**
   * Handle notification action (user tapped notification)
   */
  async handleNotificationAction(action) {
    console.log('Notification action:', action);
    
    const { notification, actionId } = action;
    const { medicationId } = notification.extra || {};

    if (actionId === 'tap' && medicationId) {
      // Navigate to medications page or mark as taken
      console.log(`User tapped notification for medication ${medicationId}`);
      // You can implement navigation here
    }
  }

  /**
   * Helper: Convert VAPID key to Uint8Array (for web push)
   */
  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  /**
   * Check if notifications are supported
   */
  isSupported() {
    if (this.isNative) {
      return true; // Always supported on native
    }
    return 'Notification' in window && 'serviceWorker' in navigator;
  }

  /**
   * Check if notifications are enabled
   */
  isEnabled() {
    return this.permissionsGranted;
  }

  /**
   * Get platform type
   */
  getPlatform() {
    return this.isNative ? 'native' : 'web';
  }
}

// Export singleton instance
const notificationManager = new NotificationManager();
export default notificationManager;
