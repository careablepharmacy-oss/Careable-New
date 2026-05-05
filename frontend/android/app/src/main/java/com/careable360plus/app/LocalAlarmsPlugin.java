package com.careable360plus.app;

import android.Manifest;
import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.util.Log;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

@CapacitorPlugin(
    name = "LocalAlarms",
    permissions = {
        @Permission(strings = {Manifest.permission.POST_NOTIFICATIONS}, alias = "notifications"),
        @Permission(strings = {Manifest.permission.SCHEDULE_EXACT_ALARM}, alias = "exact_alarm")
    }
)
public class LocalAlarmsPlugin extends Plugin {
    
    private static final String TAG = "LocalAlarmsPlugin";
    private AlarmManager alarmManager;
    
    @Override
    public void load() {
        super.load();
        alarmManager = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
        Log.d(TAG, "========================================");
        Log.d(TAG, "LocalAlarmsPlugin SUCCESSFULLY LOADED!");
        Log.d(TAG, "Version: ALARM-CLOCK-v1 (uses setAlarmClock)");
        Log.d(TAG, "========================================");
    }
    
    @PluginMethod
    public void requestPermissions(PluginCall call) {
        Log.d(TAG, "requestPermissions called");
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            // Android 13+ requires runtime permission for notifications
            if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                requestPermissionForAlias("notifications", call, "permissionCallback");
                return;
            }
        }
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            // Android 12+ check if can schedule exact alarms
            if (!alarmManager.canScheduleExactAlarms()) {
                JSObject ret = new JSObject();
                ret.put("granted", false);
                ret.put("message", "SCHEDULE_EXACT_ALARM permission not granted. Please enable in settings.");
                call.resolve(ret);
                return;
            }
        }
        
        JSObject ret = new JSObject();
        ret.put("granted", true);
        call.resolve(ret);
    }
    
    @PluginMethod
    public void checkPermissions(PluginCall call) {
        Log.d(TAG, "checkPermissions called");
        
        boolean granted = true;
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            granted = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS)
                    == PackageManager.PERMISSION_GRANTED;
        }
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            granted = granted && alarmManager.canScheduleExactAlarms();
        }
        
        JSObject ret = new JSObject();
        ret.put("granted", granted);
        call.resolve(ret);
    }
    
    @PluginMethod
    public void scheduleNotifications(PluginCall call) {
        Log.d(TAG, "scheduleNotifications called");
        
        try {
            JSArray notificationsArray = call.getArray("notifications");
            if (notificationsArray == null) {
                call.reject("notifications array is required");
                return;
            }
            
            List<Integer> scheduledIds = new ArrayList<>();
            MedicationScheduleStorage storage = new MedicationScheduleStorage(getContext());
            
            for (int i = 0; i < notificationsArray.length(); i++) {
                JSONObject notification = notificationsArray.getJSONObject(i);
                int id = notification.getInt("id");
                String title = notification.getString("title");
                String body = notification.getString("body");
                long scheduleAt = notification.getLong("scheduleAt"); // Unix timestamp in milliseconds
                
                // Optional fields
                String channelId = notification.optString("channelId", "medication_reminders");
                String urgency = notification.optString("urgency", "normal");
                
                // Medication metadata for auto-rescheduling
                String medicationId = notification.optString("medicationId", "");
                String medicationName = notification.optString("medicationName", "");
                String frequency = notification.optString("frequency", "daily");
                String time = notification.optString("time", "09:00");
                String weeklyDays = notification.optString("weeklyDays", "[]");
                String endDate = notification.optString("endDate", "");
                
                // Save schedule to storage for rescheduling
                storage.saveSchedule(id, medicationId, medicationName, frequency, time, weeklyDays, endDate);
                Log.d(TAG, "Saved schedule metadata: " + medicationName + " (" + frequency + " at " + time + ")");
                
                // Create intent for AlarmReceiver
                Intent intent = new Intent(getContext(), AlarmReceiver.class);
                intent.setAction("com.careable360plus.app.ALARM_TRIGGERED");
                intent.putExtra("notificationId", id);
                intent.putExtra("title", title);
                intent.putExtra("body", body);
                intent.putExtra("channelId", channelId);
                intent.putExtra("urgency", urgency);
                
                // Add metadata to intent for rescheduling
                intent.putExtra("medicationId", medicationId);
                intent.putExtra("medicationName", medicationName);
                intent.putExtra("frequency", frequency);
                intent.putExtra("time", time);
                intent.putExtra("weeklyDays", weeklyDays);
                intent.putExtra("endDate", endDate);
                
                // Create pending intent
                PendingIntent pendingIntent = PendingIntent.getBroadcast(
                    getContext(),
                    id,
                    intent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                );
                
                // Schedule using setAlarmClock - THE MOST RELIABLE METHOD
                // setAlarmClock() is what the native Clock app uses
                // It shows alarm icon in status bar and CANNOT be deferred by Doze
                
                // Create a show intent that opens the app when alarm icon is tapped
                Intent showIntent = new Intent(getContext(), MainActivity.class);
                showIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                PendingIntent showPendingIntent = PendingIntent.getActivity(
                    getContext(),
                    id + 100000, // Different ID for show intent
                    showIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                );
                
                // Use AlarmClockInfo for setAlarmClock
                AlarmManager.AlarmClockInfo alarmClockInfo = new AlarmManager.AlarmClockInfo(
                    scheduleAt,
                    showPendingIntent
                );
                
                // setAlarmClock is available from API 21 (Android 5.0)
                alarmManager.setAlarmClock(alarmClockInfo, pendingIntent);
                Log.d(TAG, "✅ Scheduled ALARM CLOCK ID " + id + " for " + scheduleAt + " using setAlarmClock()");
                Log.d(TAG, "   -> This alarm WILL fire exactly on time and show alarm icon in status bar");
                
                scheduledIds.add(id);
            }
            
            JSObject ret = new JSObject();
            ret.put("scheduled", scheduledIds.size());
            ret.put("ids", new JSArray(scheduledIds));
            call.resolve(ret);
            
        } catch (JSONException e) {
            Log.e(TAG, "Error scheduling notifications", e);
            call.reject("Error parsing notification data: " + e.getMessage());
        } catch (Exception e) {
            Log.e(TAG, "Error scheduling alarms", e);
            call.reject("Error scheduling alarms: " + e.getMessage());
        }
    }
    
    @PluginMethod
    public void cancelNotification(PluginCall call) {
        Log.d(TAG, "cancelNotification called");
        
        Integer id = call.getInt("id");
        if (id == null) {
            call.reject("id is required");
            return;
        }
        
        try {
            Intent intent = new Intent(getContext(), AlarmReceiver.class);
            PendingIntent pendingIntent = PendingIntent.getBroadcast(
                getContext(),
                id,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            
            alarmManager.cancel(pendingIntent);
            pendingIntent.cancel();
            
            Log.d(TAG, "Cancelled alarm ID " + id);
            
            JSObject ret = new JSObject();
            ret.put("cancelled", true);
            call.resolve(ret);
            
        } catch (Exception e) {
            Log.e(TAG, "Error cancelling alarm", e);
            call.reject("Error cancelling alarm: " + e.getMessage());
        }
    }
    
    @PluginMethod
    public void cancelAllNotifications(PluginCall call) {
        Log.d(TAG, "cancelAllNotifications called");
        
        // Note: There's no direct way to get all pending alarms,
        // so we'll cancel a reasonable range of IDs (0-10000)
        // The frontend should track IDs and call cancelNotification individually for better control
        
        int cancelledCount = 0;
        for (int id = 0; id < 10000; id++) {
            try {
                Intent intent = new Intent(getContext(), AlarmReceiver.class);
                PendingIntent pendingIntent = PendingIntent.getBroadcast(
                    getContext(),
                    id,
                    intent,
                    PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE
                );
                
                if (pendingIntent != null) {
                    alarmManager.cancel(pendingIntent);
                    pendingIntent.cancel();
                    cancelledCount++;
                }
            } catch (Exception e) {
                // Continue to next ID
            }
        }
        
        Log.d(TAG, "Cancelled " + cancelledCount + " alarms");
        
        JSObject ret = new JSObject();
        ret.put("cancelled", cancelledCount);
        call.resolve(ret);
    }
}
