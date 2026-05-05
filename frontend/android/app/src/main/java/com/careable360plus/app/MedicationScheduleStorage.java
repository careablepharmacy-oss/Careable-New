package com.careable360plus.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/**
 * Storage manager for medication schedules
 * Uses SharedPreferences to persist schedule data for alarm rescheduling
 */
public class MedicationScheduleStorage {
    
    private static final String TAG = "MedicationScheduleStorage";
    private static final String PREF_NAME = "medication_schedules";
    private static final String KEY_SCHEDULES = "schedules";
    
    private final SharedPreferences prefs;
    
    public MedicationScheduleStorage(Context context) {
        this.prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
    }
    
    /**
     * Save a medication schedule
     */
    public void saveSchedule(int notificationId, String medicationId, String medicationName,
                            String frequency, String time, String weeklyDays, String endDate) {
        try {
            JSONObject schedule = new JSONObject();
            schedule.put("notificationId", notificationId);
            schedule.put("medicationId", medicationId);
            schedule.put("medicationName", medicationName);
            schedule.put("frequency", frequency);
            schedule.put("time", time);
            schedule.put("weeklyDays", weeklyDays); // JSON string of array
            schedule.put("endDate", endDate);
            
            // Get existing schedules
            JSONArray schedules = getAllSchedulesJSON();
            
            // Check if this notification ID already exists, update if so
            boolean found = false;
            for (int i = 0; i < schedules.length(); i++) {
                JSONObject existing = schedules.getJSONObject(i);
                if (existing.getInt("notificationId") == notificationId) {
                    schedules.put(i, schedule);
                    found = true;
                    break;
                }
            }
            
            // Add new if not found
            if (!found) {
                schedules.put(schedule);
            }
            
            // Save back to preferences
            prefs.edit().putString(KEY_SCHEDULES, schedules.toString()).apply();
            Log.d(TAG, "Saved schedule for notification ID " + notificationId);
            
        } catch (JSONException e) {
            Log.e(TAG, "Error saving schedule", e);
        }
    }
    
    /**
     * Get schedule by notification ID
     */
    public MedicationSchedule getSchedule(int notificationId) {
        try {
            JSONArray schedules = getAllSchedulesJSON();
            
            for (int i = 0; i < schedules.length(); i++) {
                JSONObject schedule = schedules.getJSONObject(i);
                if (schedule.getInt("notificationId") == notificationId) {
                    return new MedicationSchedule(schedule);
                }
            }
        } catch (JSONException e) {
            Log.e(TAG, "Error getting schedule", e);
        }
        return null;
    }
    
    /**
     * Get all schedules
     */
    public List<MedicationSchedule> getAllSchedules() {
        List<MedicationSchedule> scheduleList = new ArrayList<>();
        try {
            JSONArray schedules = getAllSchedulesJSON();
            
            for (int i = 0; i < schedules.length(); i++) {
                JSONObject schedule = schedules.getJSONObject(i);
                scheduleList.add(new MedicationSchedule(schedule));
            }
        } catch (JSONException e) {
            Log.e(TAG, "Error getting all schedules", e);
        }
        return scheduleList;
    }
    
    /**
     * Delete a schedule by notification ID
     */
    public void deleteSchedule(int notificationId) {
        try {
            JSONArray schedules = getAllSchedulesJSON();
            JSONArray newSchedules = new JSONArray();
            
            for (int i = 0; i < schedules.length(); i++) {
                JSONObject schedule = schedules.getJSONObject(i);
                if (schedule.getInt("notificationId") != notificationId) {
                    newSchedules.put(schedule);
                }
            }
            
            prefs.edit().putString(KEY_SCHEDULES, newSchedules.toString()).apply();
            Log.d(TAG, "Deleted schedule for notification ID " + notificationId);
            
        } catch (JSONException e) {
            Log.e(TAG, "Error deleting schedule", e);
        }
    }
    
    /**
     * Clear all schedules
     */
    public void clearAll() {
        prefs.edit().clear().apply();
        Log.d(TAG, "Cleared all schedules");
    }
    
    /**
     * Get all schedules as JSON array
     */
    private JSONArray getAllSchedulesJSON() {
        String schedulesStr = prefs.getString(KEY_SCHEDULES, "[]");
        try {
            return new JSONArray(schedulesStr);
        } catch (JSONException e) {
            Log.e(TAG, "Error parsing schedules JSON", e);
            return new JSONArray();
        }
    }
    
    /**
     * Inner class representing a medication schedule
     */
    public static class MedicationSchedule {
        public int notificationId;
        public String medicationId;
        public String medicationName;
        public String frequency; // "daily" or "weekly"
        public String time; // "09:00"
        public List<String> weeklyDays; // ["monday", "wednesday"]
        public String endDate; // "2024-12-31" or empty
        
        public MedicationSchedule(JSONObject json) throws JSONException {
            this.notificationId = json.getInt("notificationId");
            this.medicationId = json.getString("medicationId");
            this.medicationName = json.getString("medicationName");
            this.frequency = json.getString("frequency");
            this.time = json.getString("time");
            this.endDate = json.optString("endDate", "");
            
            // Parse weekly days from JSON string
            this.weeklyDays = new ArrayList<>();
            String weeklyDaysStr = json.optString("weeklyDays", "[]");
            try {
                JSONArray daysArray = new JSONArray(weeklyDaysStr);
                for (int i = 0; i < daysArray.length(); i++) {
                    this.weeklyDays.add(daysArray.getString(i));
                }
            } catch (JSONException e) {
                Log.e(TAG, "Error parsing weekly days", e);
            }
        }
        
        public boolean hasEndDate() {
            return endDate != null && !endDate.isEmpty();
        }
    }
}
