package com.careable360plus.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "MainActivity";
    
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        String currentVersion = VersionCacheManager.getCurrentVersion();
        Log.d(TAG, "========================================");
        Log.d(TAG, "enCARE MainActivity onCreate");
        Log.d(TAG, "Version: " + currentVersion);
        Log.d(TAG, "========================================");
        
        // Check version and clear cache if needed
        VersionCacheManager.checkAndClearCache(this);
        Log.d(TAG, "✅ Version check and cache management complete");
        
        // Register custom plugins
        registerPlugin(AlarmClockPlugin.class);
        Log.d(TAG, "✅ Registered AlarmClockPlugin");
        
        registerPlugin(LocalAlarmsPlugin.class);
        Log.d(TAG, "✅ Registered LocalAlarmsPlugin");
        
        registerPlugin(BatteryOptimizationPlugin.class);
        Log.d(TAG, "✅ Registered BatteryOptimizationPlugin");
        
        // Create notification channels
        createNotificationChannels();
        
        // Note: OneSignal is initialized via JavaScript/Capacitor
        // No native initialization needed here
        Log.d(TAG, "✅ OneSignal will be initialized via JavaScript");
        
        Log.d(TAG, "✅ MainActivity initialization complete");
    }
    
    private void createNotificationChannels() {
        // Only needed for Android 8.0 (API level 26) and above
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            
            // IMPORTANT: Delete ALL existing channels first.
            // Android notification channels are IMMUTABLE after creation — sound settings
            // cannot be updated by calling createNotificationChannel() again.
            // Deleting and recreating ensures the correct sound is always applied.
            notificationManager.deleteNotificationChannel("medication_reminders");
            notificationManager.deleteNotificationChannel("urgent_medication");
            notificationManager.deleteNotificationChannel("appointment_reminders");
            notificationManager.deleteNotificationChannel("low_stock_alerts");
            notificationManager.deleteNotificationChannel("alarm_reminders");
            notificationManager.deleteNotificationChannel("medication_alarm_v2");
            notificationManager.deleteNotificationChannel("onesignal_push");
            Log.d(TAG, "Deleted all old notification channels for fresh recreation");
            
            // Custom sound URIs
            android.net.Uri medicationSoundUri = android.net.Uri.parse(
                "android.resource://" + getPackageName() + "/raw/medicine_pending"
            );
            android.net.Uri openingBellUri = android.net.Uri.parse(
                "android.resource://" + getPackageName() + "/raw/opening_bell"
            );
            // System default alarm sound for local alarms
            android.net.Uri defaultAlarmUri = android.media.RingtoneManager.getDefaultUri(
                android.media.RingtoneManager.TYPE_ALARM
            );
            
            // Audio attributes for notification sounds (OneSignal push)
            android.media.AudioAttributes notificationAudioAttributes = new android.media.AudioAttributes.Builder()
                .setContentType(android.media.AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(android.media.AudioAttributes.USAGE_NOTIFICATION)
                .build();
            
            // Audio attributes for ALARM sounds - plays at full volume, works in DND
            android.media.AudioAttributes alarmAudioAttributes = new android.media.AudioAttributes.Builder()
                .setContentType(android.media.AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(android.media.AudioAttributes.USAGE_ALARM)
                .build();
            
            // ===== OneSignal Push Channels (custom sounds) =====
            
            // Medication Reminders Channel — Medicine_pending.mp3
            NotificationChannel medicationChannel = new NotificationChannel(
                "medication_reminders",
                "Medication Reminders",
                NotificationManager.IMPORTANCE_HIGH
            );
            medicationChannel.setDescription("Push reminders for medication times (Medicine_pending sound)");
            medicationChannel.enableVibration(true);
            medicationChannel.setVibrationPattern(new long[]{200, 100, 200});
            medicationChannel.enableLights(true);
            medicationChannel.setLightColor(0xFF10B981);
            medicationChannel.setShowBadge(true);
            medicationChannel.setSound(medicationSoundUri, notificationAudioAttributes);
            notificationManager.createNotificationChannel(medicationChannel);
            Log.d(TAG, "Created medication_reminders channel with Medicine_pending.mp3");
            
            // Urgent Medication Reminders Channel — Medicine_pending.mp3
            NotificationChannel urgentChannel = new NotificationChannel(
                "urgent_medication",
                "Urgent Medication Alerts",
                NotificationManager.IMPORTANCE_HIGH
            );
            urgentChannel.setDescription("Urgent reminders for missed medications (Medicine_pending sound)");
            urgentChannel.enableVibration(true);
            urgentChannel.setVibrationPattern(new long[]{300, 100, 300, 100, 300});
            urgentChannel.enableLights(true);
            urgentChannel.setLightColor(0xFFFF0000);
            urgentChannel.setShowBadge(true);
            urgentChannel.setSound(medicationSoundUri, notificationAudioAttributes);
            notificationManager.createNotificationChannel(urgentChannel);
            
            // Appointment Reminders Channel — opening-bell.mp3
            NotificationChannel appointmentChannel = new NotificationChannel(
                "appointment_reminders",
                "Appointment Reminders",
                NotificationManager.IMPORTANCE_HIGH
            );
            appointmentChannel.setDescription("Reminders for doctor and lab appointments (opening-bell sound)");
            appointmentChannel.enableVibration(true);
            appointmentChannel.setVibrationPattern(new long[]{200, 100, 200});
            appointmentChannel.enableLights(true);
            appointmentChannel.setLightColor(0xFF3B82F6);
            appointmentChannel.setShowBadge(true);
            appointmentChannel.setSound(openingBellUri, notificationAudioAttributes);
            appointmentChannel.setBypassDnd(true);
            notificationManager.createNotificationChannel(appointmentChannel);
            Log.d(TAG, "Created appointment_reminders channel with opening-bell.mp3");
            
            // Low Stock Alerts Channel — opening-bell.mp3
            NotificationChannel lowStockChannel = new NotificationChannel(
                "low_stock_alerts",
                "Low Stock Alerts",
                NotificationManager.IMPORTANCE_HIGH
            );
            lowStockChannel.setDescription("Alerts when medication stock is running low (opening-bell sound)");
            lowStockChannel.enableVibration(true);
            lowStockChannel.setVibrationPattern(new long[]{200, 100, 200});
            lowStockChannel.enableLights(true);
            lowStockChannel.setLightColor(0xFFF59E0B);
            lowStockChannel.setShowBadge(true);
            lowStockChannel.setSound(openingBellUri, notificationAudioAttributes);
            lowStockChannel.setBypassDnd(true);
            notificationManager.createNotificationChannel(lowStockChannel);
            Log.d(TAG, "Created low_stock_alerts channel with opening-bell.mp3");
            
            // ===== Local Alarm Channel (system default alarm sound) =====
            
            // Medication Alarm Channel — System default alarm sound
            NotificationChannel alarmChannel = new NotificationChannel(
                "medication_alarm_v2",
                "Medication Alarms",
                NotificationManager.IMPORTANCE_HIGH
            );
            alarmChannel.setDescription("Loud alarms for medication times - uses system default alarm sound");
            alarmChannel.enableVibration(true);
            alarmChannel.setVibrationPattern(new long[]{0, 1000, 500, 1000, 500, 1000, 500, 1000, 500, 1000, 500, 1000, 500, 1000, 500});
            alarmChannel.setSound(defaultAlarmUri, alarmAudioAttributes);
            alarmChannel.enableLights(true);
            alarmChannel.setLightColor(0xFFFF0000);
            alarmChannel.setShowBadge(true);
            alarmChannel.setBypassDnd(true);
            alarmChannel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
            notificationManager.createNotificationChannel(alarmChannel);
            Log.d(TAG, "Created medication_alarm_v2 channel with system default alarm sound");
            
            // ===== Caregiver / Default Push Channel (system default sound) =====
            
            // OneSignal Push Channel — System default notification sound
            NotificationChannel pushChannel = new NotificationChannel(
                "onesignal_push",
                "Push Notifications",
                NotificationManager.IMPORTANCE_HIGH
            );
            pushChannel.setDescription("Push notifications from enCARE (system default sound)");
            pushChannel.enableVibration(true);
            pushChannel.setShowBadge(true);
            // No setSound() — uses system default notification sound
            notificationManager.createNotificationChannel(pushChannel);
            
            Log.d(TAG, "All notification channels created successfully");
        }
    }
}
