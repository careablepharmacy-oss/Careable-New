package com.careable360plus.app;

import android.app.AlarmManager;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONException;

import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.List;
import java.util.Locale;

public class AlarmReceiver extends BroadcastReceiver {
    
    private static final String TAG = "AlarmReceiver";
    private static final long IST_OFFSET_MS = 5 * 60 * 60 * 1000 + 30 * 60 * 1000; // 5 hours 30 minutes
    
    @Override
    public void onReceive(Context context, Intent intent) {
        Log.d(TAG, "Alarm received!");
        
        if (intent == null || !"com.careable360plus.app.ALARM_TRIGGERED".equals(intent.getAction())) {
            Log.e(TAG, "Invalid intent or action");
            return;
        }
        
        try {
            int notificationId = intent.getIntExtra("notificationId", -1);
            String title = intent.getStringExtra("title");
            String body = intent.getStringExtra("body");
            String channelId = intent.getStringExtra("channelId");
            String urgency = intent.getStringExtra("urgency");
            
            // Metadata for rescheduling
            String medicationId = intent.getStringExtra("medicationId");
            String medicationName = intent.getStringExtra("medicationName");
            String frequency = intent.getStringExtra("frequency");
            String time = intent.getStringExtra("time");
            String weeklyDays = intent.getStringExtra("weeklyDays");
            String endDate = intent.getStringExtra("endDate");
            
            if (notificationId == -1 || title == null || body == null) {
                Log.e(TAG, "Missing notification data");
                return;
            }
            
            Log.d(TAG, "Showing notification: " + title + " (ID: " + notificationId + ")");
            Log.d(TAG, "Schedule metadata - Frequency: " + frequency + ", Time: " + time + ", End Date: " + endDate);
            
            // STEP 1: Show the notification
            NotificationHelper notificationHelper = new NotificationHelper(context);
            notificationHelper.showNotification(notificationId, title, body, channelId, urgency);
            
            // STEP 2: Check if we need to reschedule (check end date)
            if (endDate != null && !endDate.isEmpty()) {
                if (hasReachedEndDate(endDate)) {
                    Log.d(TAG, "End date reached, not rescheduling alarm ID " + notificationId);
                    // Remove from storage
                    MedicationScheduleStorage storage = new MedicationScheduleStorage(context);
                    storage.deleteSchedule(notificationId);
                    return;
                }
            }
            
            // STEP 3: Calculate next occurrence and reschedule
            long nextAlarmTime = calculateNextOccurrence(frequency, time, weeklyDays);
            
            if (nextAlarmTime > 0) {
                rescheduleAlarm(context, notificationId, medicationName, time, nextAlarmTime, 
                               channelId, urgency, medicationId, frequency, weeklyDays, endDate);
            } else {
                Log.e(TAG, "Failed to calculate next occurrence");
            }
            
        } catch (Exception e) {
            Log.e(TAG, "Error handling alarm", e);
        }
    }
    
    /**
     * Check if medication has reached its end date
     */
    private boolean hasReachedEndDate(String endDate) {
        try {
            SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
            Date end = sdf.parse(endDate);
            Date today = new Date();
            
            // Compare dates (ignore time)
            Calendar endCal = Calendar.getInstance();
            endCal.setTime(end);
            endCal.set(Calendar.HOUR_OF_DAY, 23);
            endCal.set(Calendar.MINUTE, 59);
            endCal.set(Calendar.SECOND, 59);
            
            return today.after(endCal.getTime());
        } catch (ParseException e) {
            Log.e(TAG, "Error parsing end date", e);
            return false;
        }
    }
    
    /**
     * Calculate next occurrence based on frequency
     */
    private long calculateNextOccurrence(String frequency, String time, String weeklyDays) {
        try {
            // Parse time (HH:mm format)
            String[] timeParts = time.split(":");
            int hours = Integer.parseInt(timeParts[0]);
            int minutes = Integer.parseInt(timeParts[1]);
            
            long nowUTC_ms = System.currentTimeMillis();
            long nowIST_ms = nowUTC_ms + IST_OFFSET_MS;
            
            if ("daily".equals(frequency)) {
                // Daily: Add 24 hours to current time
                Calendar cal = Calendar.getInstance();
                cal.setTimeInMillis(nowIST_ms);
                
                // Set to today at the specified time
                cal.set(Calendar.HOUR_OF_DAY, hours);
                cal.set(Calendar.MINUTE, minutes);
                cal.set(Calendar.SECOND, 0);
                cal.set(Calendar.MILLISECOND, 0);
                
                // Add 24 hours for tomorrow
                cal.add(Calendar.DAY_OF_MONTH, 1);
                
                // Convert back to UTC
                long nextIST_ms = cal.getTimeInMillis();
                long nextUTC_ms = nextIST_ms - IST_OFFSET_MS;
                
                Log.d(TAG, "Next daily occurrence (UTC): " + new Date(nextUTC_ms));
                return nextUTC_ms;
                
            } else if ("weekly".equals(frequency)) {
                // Weekly: Find next occurrence based on selected days
                return calculateNextWeeklyOccurrence(weeklyDays, hours, minutes, nowIST_ms);
            }
            
        } catch (Exception e) {
            Log.e(TAG, "Error calculating next occurrence", e);
        }
        
        return 0;
    }
    
    /**
     * Calculate next weekly occurrence based on selected days
     */
    private long calculateNextWeeklyOccurrence(String weeklyDaysJson, int hours, int minutes, long nowIST_ms) {
        try {
            // Parse weekly days from JSON array string
            JSONArray daysArray = new JSONArray(weeklyDaysJson);
            int[] selectedDays = new int[daysArray.length()];
            
            for (int i = 0; i < daysArray.length(); i++) {
                String day = daysArray.getString(i).toLowerCase();
                selectedDays[i] = getDayOfWeekNumber(day);
            }
            
            Calendar cal = Calendar.getInstance();
            cal.setTimeInMillis(nowIST_ms);
            
            int currentDay = cal.get(Calendar.DAY_OF_WEEK); // 1=Sunday, 7=Saturday
            
            Log.d(TAG, "Current day: " + currentDay + " (1=Sun, 7=Sat)");
            Log.d(TAG, "Selected days: " + weeklyDaysJson);
            
            // Find next occurrence
            Integer nextDay = null;
            int daysToAdd = 0;
            
            // Check remaining days this week (including today)
            for (int i = 0; i <= 7; i++) {
                int checkDay = ((currentDay - 1 + i) % 7) + 1; // Wrap around to 1-7
                
                for (int selectedDay : selectedDays) {
                    if (checkDay == selectedDay) {
                        // Check if time hasn't passed today (i==0)
                        if (i == 0) {
                            cal.set(Calendar.HOUR_OF_DAY, hours);
                            cal.set(Calendar.MINUTE, minutes);
                            cal.set(Calendar.SECOND, 0);
                            cal.set(Calendar.MILLISECOND, 0);
                            
                            if (cal.getTimeInMillis() > nowIST_ms) {
                                // Today's time hasn't passed
                                nextDay = checkDay;
                                daysToAdd = i;
                                break;
                            }
                        } else {
                            nextDay = checkDay;
                            daysToAdd = i;
                            break;
                        }
                    }
                }
                
                if (nextDay != null) break;
            }
            
            if (nextDay == null) {
                Log.e(TAG, "No valid next day found in weekly schedule");
                return 0;
            }
            
            // Calculate next occurrence
            Calendar nextCal = Calendar.getInstance();
            nextCal.setTimeInMillis(nowIST_ms);
            nextCal.add(Calendar.DAY_OF_MONTH, daysToAdd);
            nextCal.set(Calendar.HOUR_OF_DAY, hours);
            nextCal.set(Calendar.MINUTE, minutes);
            nextCal.set(Calendar.SECOND, 0);
            nextCal.set(Calendar.MILLISECOND, 0);
            
            long nextIST_ms = nextCal.getTimeInMillis();
            long nextUTC_ms = nextIST_ms - IST_OFFSET_MS;
            
            Log.d(TAG, "Next weekly occurrence (UTC): " + new Date(nextUTC_ms) + " (+" + daysToAdd + " days)");
            return nextUTC_ms;
            
        } catch (JSONException e) {
            Log.e(TAG, "Error parsing weekly days", e);
            return 0;
        }
    }
    
    /**
     * Convert day name to Calendar day number
     */
    private int getDayOfWeekNumber(String day) {
        switch (day) {
            case "sunday": return Calendar.SUNDAY;
            case "monday": return Calendar.MONDAY;
            case "tuesday": return Calendar.TUESDAY;
            case "wednesday": return Calendar.WEDNESDAY;
            case "thursday": return Calendar.THURSDAY;
            case "friday": return Calendar.FRIDAY;
            case "saturday": return Calendar.SATURDAY;
            default: return Calendar.SUNDAY;
        }
    }
    
    /**
     * Reschedule the alarm for next occurrence using setAlarmClock
     */
    private void rescheduleAlarm(Context context, int notificationId, String medicationName, String time,
                                 long scheduleAt, String channelId, String urgency,
                                 String medicationId, String frequency, String weeklyDays, String endDate) {
        try {
            AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            
            // Create intent with same data
            Intent intent = new Intent(context, AlarmReceiver.class);
            intent.setAction("com.careable360plus.app.ALARM_TRIGGERED");
            intent.putExtra("notificationId", notificationId);
            intent.putExtra("title", "⏰ Medication Alarm");
            intent.putExtra("body", "Time to take " + medicationName + " (" + time + " IST)");
            intent.putExtra("channelId", channelId);
            intent.putExtra("urgency", urgency);
            intent.putExtra("medicationId", medicationId);
            intent.putExtra("medicationName", medicationName);
            intent.putExtra("frequency", frequency);
            intent.putExtra("time", time);
            intent.putExtra("weeklyDays", weeklyDays);
            intent.putExtra("endDate", endDate);
            
            PendingIntent pendingIntent = PendingIntent.getBroadcast(
                context,
                notificationId,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            
            // Create show intent for alarm clock info
            Intent showIntent = new Intent(context, MainActivity.class);
            showIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent showPendingIntent = PendingIntent.getActivity(
                context,
                notificationId + 100000,
                showIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            
            // Use setAlarmClock - the most reliable method
            AlarmManager.AlarmClockInfo alarmClockInfo = new AlarmManager.AlarmClockInfo(
                scheduleAt,
                showPendingIntent
            );
            
            alarmManager.setAlarmClock(alarmClockInfo, pendingIntent);
            Log.d(TAG, "✅ Rescheduled ALARM CLOCK ID " + notificationId + " for " + new Date(scheduleAt) + " using setAlarmClock()");
            
        } catch (Exception e) {
            Log.e(TAG, "Error rescheduling alarm", e);
        }
    }
}
