package com.careable360plus.app;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Plugin to check and request battery optimization exemption
 * This is critical for alarms to work reliably when phone is locked
 */
@CapacitorPlugin(name = "BatteryOptimization")
public class BatteryOptimizationPlugin extends Plugin {
    
    private static final String TAG = "BatteryOptPlugin";
    
    /**
     * Check if the app is ignoring battery optimizations
     */
    @PluginMethod
    public void isIgnoringBatteryOptimizations(PluginCall call) {
        try {
            PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
            String packageName = getContext().getPackageName();
            
            boolean isIgnoring = false;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                isIgnoring = pm.isIgnoringBatteryOptimizations(packageName);
            } else {
                // Pre-Marshmallow doesn't have battery optimization
                isIgnoring = true;
            }
            
            Log.d(TAG, "Battery optimization ignored: " + isIgnoring);
            
            JSObject ret = new JSObject();
            ret.put("isIgnoring", isIgnoring);
            call.resolve(ret);
            
        } catch (Exception e) {
            Log.e(TAG, "Error checking battery optimization", e);
            call.reject("Failed to check battery optimization: " + e.getMessage());
        }
    }
    
    /**
     * Open battery optimization settings for this app
     */
    @PluginMethod
    public void openBatteryOptimizationSettings(PluginCall call) {
        try {
            String packageName = getContext().getPackageName();
            
            Intent intent;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                // Direct to app's battery optimization settings
                intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                intent.setData(Uri.parse("package:" + packageName));
            } else {
                // Fallback to general battery settings
                intent = new Intent(Settings.ACTION_BATTERY_SAVER_SETTINGS);
            }
            
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            
            Log.d(TAG, "Opened battery optimization settings");
            
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
            
        } catch (Exception e) {
            Log.e(TAG, "Error opening battery settings", e);
            
            // Try alternative method - open app info page
            try {
                Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
                
                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("fallback", true);
                call.resolve(ret);
            } catch (Exception e2) {
                call.reject("Failed to open battery settings: " + e2.getMessage());
            }
        }
    }
    
    /**
     * Check if exact alarms are allowed (Android 12+)
     */
    @PluginMethod
    public void canScheduleExactAlarms(PluginCall call) {
        try {
            boolean canSchedule = true;
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                android.app.AlarmManager alarmManager = 
                    (android.app.AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
                canSchedule = alarmManager.canScheduleExactAlarms();
            }
            
            Log.d(TAG, "Can schedule exact alarms: " + canSchedule);
            
            JSObject ret = new JSObject();
            ret.put("canSchedule", canSchedule);
            call.resolve(ret);
            
        } catch (Exception e) {
            Log.e(TAG, "Error checking exact alarm permission", e);
            call.reject("Failed to check exact alarm permission: " + e.getMessage());
        }
    }
    
    /**
     * Open exact alarm settings (Android 12+)
     */
    @PluginMethod
    public void openExactAlarmSettings(PluginCall call) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                Intent intent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
                intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
                
                JSObject ret = new JSObject();
                ret.put("success", true);
                call.resolve(ret);
            } else {
                // Not needed for pre-Android 12
                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("notRequired", true);
                call.resolve(ret);
            }
            
        } catch (Exception e) {
            Log.e(TAG, "Error opening exact alarm settings", e);
            call.reject("Failed to open exact alarm settings: " + e.getMessage());
        }
    }
    
    /**
     * Get comprehensive permission status
     */
    @PluginMethod
    public void getPermissionStatus(PluginCall call) {
        try {
            JSObject ret = new JSObject();
            
            // Check battery optimization
            PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
            String packageName = getContext().getPackageName();
            
            boolean batteryOptIgnored = true;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                batteryOptIgnored = pm.isIgnoringBatteryOptimizations(packageName);
            }
            ret.put("batteryOptimizationIgnored", batteryOptIgnored);
            
            // Check exact alarm permission (Android 12+)
            boolean canScheduleExact = true;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                android.app.AlarmManager alarmManager = 
                    (android.app.AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
                canScheduleExact = alarmManager.canScheduleExactAlarms();
            }
            ret.put("canScheduleExactAlarms", canScheduleExact);
            
            // Check notification permission (Android 13+)
            boolean notificationsEnabled = true;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                android.app.NotificationManager nm = 
                    (android.app.NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
                notificationsEnabled = nm.areNotificationsEnabled();
            }
            ret.put("notificationsEnabled", notificationsEnabled);
            
            // Check full screen intent permission (Android 14+)
            boolean canUseFullScreenIntent = true;
            if (Build.VERSION.SDK_INT >= 34) { // Android 14 = API 34
                android.app.NotificationManager nm = 
                    (android.app.NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
                canUseFullScreenIntent = nm.canUseFullScreenIntent();
            }
            ret.put("canUseFullScreenIntent", canUseFullScreenIntent);
            
            // Overall status
            boolean allPermissionsGranted = batteryOptIgnored && canScheduleExact && notificationsEnabled && canUseFullScreenIntent;
            ret.put("allPermissionsGranted", allPermissionsGranted);
            
            // Add Android version info for debugging
            ret.put("androidVersion", Build.VERSION.SDK_INT);
            ret.put("androidRelease", Build.VERSION.RELEASE);
            
            Log.d(TAG, "Permission status: battery=" + batteryOptIgnored + 
                      ", exactAlarm=" + canScheduleExact + ", notifications=" + notificationsEnabled +
                      ", fullScreenIntent=" + canUseFullScreenIntent);
            
            call.resolve(ret);
            
        } catch (Exception e) {
            Log.e(TAG, "Error getting permission status", e);
            call.reject("Failed to get permission status: " + e.getMessage());
        }
    }
    
    /**
     * Open full screen intent settings (Android 14+)
     */
    @PluginMethod
    public void openFullScreenIntentSettings(PluginCall call) {
        try {
            if (Build.VERSION.SDK_INT >= 34) {
                Intent intent = new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT);
                intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
                
                JSObject ret = new JSObject();
                ret.put("success", true);
                call.resolve(ret);
            } else {
                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("notRequired", true);
                ret.put("message", "Full screen intent permission not required on Android " + Build.VERSION.SDK_INT);
                call.resolve(ret);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error opening full screen intent settings", e);
            call.reject("Failed to open settings: " + e.getMessage());
        }
    }
}
