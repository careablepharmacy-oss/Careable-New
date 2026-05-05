package com.careable360plus.app;

import android.content.Intent;
import android.os.Build;
import android.provider.AlarmClock;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Custom plugin to set alarms using Android's AlarmClock
 */
@CapacitorPlugin(name = "AlarmClock")
public class AlarmClockPlugin extends Plugin {
    
    private static final String TAG = "AlarmClockPlugin";
    
    @PluginMethod
    public void setAlarm(PluginCall call) {
        int hour = call.getInt("hour", -1);
        int minute = call.getInt("minute", -1);
        String message = call.getString("message", "Medication Time");
        
        Log.d(TAG, "setAlarm called - hour: " + hour + ", minute: " + minute + ", message: " + message);
        
        if (hour == -1 || minute == -1) {
            Log.e(TAG, "Hour and minute are required");
            call.reject("Hour and minute are required");
            return;
        }
        
        try {
            Intent intent = new Intent(AlarmClock.ACTION_SET_ALARM);
            intent.putExtra(AlarmClock.EXTRA_HOUR, hour);
            intent.putExtra(AlarmClock.EXTRA_MINUTES, minute);
            intent.putExtra(AlarmClock.EXTRA_MESSAGE, message);
            intent.putExtra(AlarmClock.EXTRA_SKIP_UI, true); // Don't show alarm UI
            intent.putExtra(AlarmClock.EXTRA_VIBRATE, true); // Enable vibration
            
            // Note: Daily repeat is handled by Android's Clock app by default
            // The alarm will be created and user can configure repeat in Clock app
            
            Log.d(TAG, "Starting alarm intent...");
            getContext().startActivity(intent);
            
            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("message", "Alarm set successfully");
            call.resolve(ret);
            
            Log.d(TAG, "✅ Alarm set for " + hour + ":" + minute);
            
        } catch (Exception e) {
            Log.e(TAG, "❌ Error setting alarm", e);
            call.reject("Failed to set alarm: " + e.getMessage());
        }
    }
}
