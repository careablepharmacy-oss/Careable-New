package com.careable360plus.app;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

import androidx.core.app.NotificationCompat;

public class NotificationHelper {
    
    private static final String TAG = "NotificationHelper";
    private Context context;
    private NotificationManager notificationManager;
    
    public NotificationHelper(Context context) {
        this.context = context;
        this.notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
    }
    
    public void showNotification(int id, String title, String body, String channelId, String urgency) {
        Log.d(TAG, "Creating notification - ID: " + id + ", Title: " + title + ", Channel: " + channelId + ", Urgency: " + urgency);
        
        // Determine channel based on urgency
        String finalChannelId = channelId;
        if (channelId == null || channelId.isEmpty()) {
            finalChannelId = getChannelForUrgency(urgency);
        }
        
        // Check if this is an alarm notification
        boolean isAlarm = "alarm_reminders".equals(finalChannelId) || "medication_alarm_v2".equals(finalChannelId) || "alarm".equals(urgency);
        
        // Create intent to open app when notification is tapped
        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        intent.putExtra("notification_id", id);
        intent.putExtra("from_alarm", isAlarm);
        
        PendingIntent pendingIntent = PendingIntent.getActivity(
            context,
            id,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        
        // Build notification
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, finalChannelId)
            .setSmallIcon(R.drawable.ic_stat_icon_config_sample)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(getPriorityForUrgency(urgency))
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC); // Show on lock screen
        
        // For alarm notifications - use full-screen intent and alarm category
        if (isAlarm) {
            Log.d(TAG, "Setting up ALARM notification with full-screen intent");
            
            // Set alarm category
            builder.setCategory(NotificationCompat.CATEGORY_ALARM);
            
            // Full-screen intent - wakes up the device and shows on lock screen
            Intent fullScreenIntent = new Intent(context, MainActivity.class);
            fullScreenIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            fullScreenIntent.putExtra("notification_id", id);
            fullScreenIntent.putExtra("from_alarm", true);
            fullScreenIntent.putExtra("full_screen", true);
            
            PendingIntent fullScreenPendingIntent = PendingIntent.getActivity(
                context,
                id + 10000, // Different request code for full-screen
                fullScreenIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            
            builder.setFullScreenIntent(fullScreenPendingIntent, true);
            
            // Make it persistent until user interacts
            builder.setOngoing(true);
            
            // Don't set custom sound - let the channel handle it (with USAGE_ALARM)
            builder.setDefaults(0); // Clear defaults to use channel settings
            
            Log.d(TAG, "Full-screen intent configured for alarm");
        } else {
            // For non-alarm notifications
            builder.setAutoCancel(true);
            
            // Add vibration pattern based on urgency
            long[] vibrationPattern = getVibrationPattern(urgency);
            if (vibrationPattern != null) {
                builder.setVibrate(vibrationPattern);
            }
            
            // Add LED color for urgent notifications
            if ("urgent".equals(urgency)) {
                builder.setLights(Color.RED, 1000, 1000);
            }
            
            // Make urgent notifications use alarm category
            if ("urgent".equals(urgency) || "followup".equals(urgency)) {
                builder.setCategory(NotificationCompat.CATEGORY_ALARM);
            }
        }
        
        // Show notification
        Notification notification = builder.build();
        notificationManager.notify(id, notification);
        
        Log.d(TAG, "Notification shown successfully - ID: " + id + ", isAlarm: " + isAlarm);
    }
    
    private String getChannelForUrgency(String urgency) {
        if ("urgent".equals(urgency) || "followup".equals(urgency)) {
            return "urgent_medication";
        } else if ("gentle".equals(urgency)) {
            return "medication_reminders";
        } else {
            return "medication_reminders";
        }
    }
    
    private int getPriorityForUrgency(String urgency) {
        if ("urgent".equals(urgency)) {
            return NotificationCompat.PRIORITY_MAX;
        } else if ("followup".equals(urgency)) {
            return NotificationCompat.PRIORITY_HIGH;
        } else if ("normal".equals(urgency)) {
            return NotificationCompat.PRIORITY_HIGH;
        } else if ("gentle".equals(urgency)) {
            return NotificationCompat.PRIORITY_DEFAULT;
        } else {
            return NotificationCompat.PRIORITY_DEFAULT;
        }
    }
    
    private long[] getVibrationPattern(String urgency) {
        if ("urgent".equals(urgency)) {
            // Strong vibration: [delay, vibrate, sleep, vibrate, sleep, vibrate]
            return new long[]{0, 300, 100, 300, 100, 300};
        } else if ("followup".equals(urgency) || "normal".equals(urgency)) {
            // Normal vibration
            return new long[]{0, 200, 100, 200};
        } else if ("gentle".equals(urgency)) {
            // Gentle vibration
            return new long[]{0, 100, 50, 100};
        } else {
            // Default vibration
            return new long[]{0, 200, 100, 200};
        }
    }
}
