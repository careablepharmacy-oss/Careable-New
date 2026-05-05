package com.careable360plus.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

import java.util.Calendar;
import java.util.List;

/**
 * Broadcast receiver that handles device boot
 * Reschedules all active medication alarms after device restart
 */
public class BootReceiver extends BroadcastReceiver {
    
    private static final String TAG = "BootReceiver";
    private static final long IST_OFFSET_MS = 5 * 60 * 60 * 1000 + 30 * 60 * 1000; // 5 hours 30 minutes
    
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) {
            return;
        }
        
        String action = intent.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(action) || 
            Intent.ACTION_LOCKED_BOOT_COMPLETED.equals(action)) {
            
            Log.d(TAG, "Device boot detected, rescheduling alarms...");
            rescheduleAllAlarms(context);
        }
    }
    
    /**
     * Reschedule all medication alarms stored in SharedPreferences
     */
    private void rescheduleAllAlarms(Context context) {
        try {
            MedicationScheduleStorage storage = new MedicationScheduleStorage(context);
            List<MedicationScheduleStorage.MedicationSchedule> schedules = storage.getAllSchedules();
            
            Log.d(TAG, "Found " + schedules.size() + " schedules to reschedule");
            
            AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            long nowUTC_ms = System.currentTimeMillis();
            long nowIST_ms = nowUTC_ms + IST_OFFSET_MS;
            
            int rescheduledCount = 0;
            
            for (MedicationScheduleStorage.MedicationSchedule schedule : schedules) {
                try {
                    // Check if end date has passed
                    if (schedule.hasEndDate() && hasReachedEndDate(schedule.endDate)) {
                        Log.d(TAG, "Skipping " + schedule.medicationName + " - end date reached");
                        storage.deleteSchedule(schedule.notificationId);
                        continue;
                    }
                    
                    // Calculate next occurrence
                    long nextAlarmTime = calculateNextOccurrence(schedule, nowIST_ms);
                    
                    if (nextAlarmTime > 0) {
                        scheduleAlarm(context, alarmManager, schedule, nextAlarmTime);
                        rescheduledCount++;
                        Log.d(TAG, "Rescheduled: " + schedule.medicationName + " at " + schedule.time);
                    } else {
                        Log.e(TAG, "Failed to calculate next occurrence for " + schedule.medicationName);
                    }
                    
                } catch (Exception e) {
                    Log.e(TAG, "Error rescheduling alarm for " + schedule.medicationName, e);
                }
            }
            
            Log.d(TAG, "Successfully rescheduled " + rescheduledCount + " alarms");
            
        } catch (Exception e) {
            Log.e(TAG, "Error in rescheduleAllAlarms", e);
        }
    }
    
    /**
     * Check if end date has been reached
     */
    private boolean hasReachedEndDate(String endDate) {
        try {
            String[] parts = endDate.split("-");
            int year = Integer.parseInt(parts[0]);
            int month = Integer.parseInt(parts[1]) - 1; // Calendar months are 0-based
            int day = Integer.parseInt(parts[2]);
            
            Calendar endCal = Calendar.getInstance();
            endCal.set(year, month, day, 23, 59, 59);
            
            Calendar now = Calendar.getInstance();
            return now.after(endCal);
        } catch (Exception e) {
            Log.e(TAG, "Error parsing end date", e);
            return false;
        }
    }
    
    /**
     * Calculate next occurrence for a schedule
     */
    private long calculateNextOccurrence(MedicationScheduleStorage.MedicationSchedule schedule, long nowIST_ms) {
        try {
            String[] timeParts = schedule.time.split(":");
            int hours = Integer.parseInt(timeParts[0]);
            int minutes = Integer.parseInt(timeParts[1]);
            
            if ("daily".equals(schedule.frequency)) {
                // Daily: Set to today or tomorrow at specified time
                Calendar cal = Calendar.getInstance();
                cal.setTimeInMillis(nowIST_ms);
                cal.set(Calendar.HOUR_OF_DAY, hours);
                cal.set(Calendar.MINUTE, minutes);
                cal.set(Calendar.SECOND, 0);
                cal.set(Calendar.MILLISECOND, 0);
                
                // If time has passed today, schedule for tomorrow
                if (cal.getTimeInMillis() <= nowIST_ms) {
                    cal.add(Calendar.DAY_OF_MONTH, 1);
                }
                
                long nextIST_ms = cal.getTimeInMillis();
                return nextIST_ms - IST_OFFSET_MS; // Convert to UTC
                
            } else if ("weekly".equals(schedule.frequency)) {
                // Weekly: Find next occurrence based on selected days
                return calculateNextWeeklyOccurrence(schedule.weeklyDays, hours, minutes, nowIST_ms);
            }
            
        } catch (Exception e) {
            Log.e(TAG, "Error calculating next occurrence", e);
        }
        
        return 0;
    }
    
    /**
     * Calculate next weekly occurrence
     */
    private long calculateNextWeeklyOccurrence(List<String> weeklyDays, int hours, int minutes, long nowIST_ms) {
        try {
            Calendar cal = Calendar.getInstance();
            cal.setTimeInMillis(nowIST_ms);
            
            int currentDay = cal.get(Calendar.DAY_OF_WEEK);
            
            // Find next occurrence
            for (int i = 0; i <= 7; i++) {
                int checkDay = ((currentDay - 1 + i) % 7) + 1;
                
                for (String day : weeklyDays) {
                    if (checkDay == getDayOfWeekNumber(day)) {
                        Calendar nextCal = Calendar.getInstance();
                        nextCal.setTimeInMillis(nowIST_ms);
                        nextCal.add(Calendar.DAY_OF_MONTH, i);
                        nextCal.set(Calendar.HOUR_OF_DAY, hours);
                        nextCal.set(Calendar.MINUTE, minutes);
                        nextCal.set(Calendar.SECOND, 0);
                        nextCal.set(Calendar.MILLISECOND, 0);
                        
                        // If today, check if time has passed
                        if (i == 0 && nextCal.getTimeInMillis() <= nowIST_ms) {
                            continue;
                        }
                        
                        long nextIST_ms = nextCal.getTimeInMillis();
                        return nextIST_ms - IST_OFFSET_MS; // Convert to UTC
                    }
                }
            }
            
        } catch (Exception e) {
            Log.e(TAG, "Error calculating weekly occurrence", e);
        }
        
        return 0;
    }
    
    /**
     * Convert day name to Calendar constant
     */
    private int getDayOfWeekNumber(String day) {
        switch (day.toLowerCase()) {
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
     * Schedule an alarm
     */
    private void scheduleAlarm(Context context, AlarmManager alarmManager,
                              MedicationScheduleStorage.MedicationSchedule schedule,
                              long scheduleAt) {
        try {
            Intent intent = new Intent(context, AlarmReceiver.class);
            intent.setAction("com.careable360plus.app.ALARM_TRIGGERED");
            intent.putExtra("notificationId", schedule.notificationId);
            intent.putExtra("title", "⏰ Medication Alarm");
            intent.putExtra("body", "Time to take " + schedule.medicationName + " (" + schedule.time + " IST)");
            intent.putExtra("channelId", "alarm_reminders");
            intent.putExtra("urgency", "alarm");
            intent.putExtra("medicationId", schedule.medicationId);
            intent.putExtra("medicationName", schedule.medicationName);
            intent.putExtra("frequency", schedule.frequency);
            intent.putExtra("time", schedule.time);
            
            // Convert weekly days list to JSON string
            StringBuilder weeklyDaysJson = new StringBuilder("[");
            for (int i = 0; i < schedule.weeklyDays.size(); i++) {
                if (i > 0) weeklyDaysJson.append(",");
                weeklyDaysJson.append("\"").append(schedule.weeklyDays.get(i)).append("\"");
            }
            weeklyDaysJson.append("]");
            intent.putExtra("weeklyDays", weeklyDaysJson.toString());
            intent.putExtra("endDate", schedule.endDate);
            
            PendingIntent pendingIntent = PendingIntent.getBroadcast(
                context,
                schedule.notificationId,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            
            // Schedule alarm based on Android version
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                if (alarmManager.canScheduleExactAlarms()) {
                    alarmManager.setExactAndAllowWhileIdle(
                        AlarmManager.RTC_WAKEUP,
                        scheduleAt,
                        pendingIntent
                    );
                }
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(
                    AlarmManager.RTC_WAKEUP,
                    scheduleAt,
                    pendingIntent
                );
            } else {
                alarmManager.setExact(
                    AlarmManager.RTC_WAKEUP,
                    scheduleAt,
                    pendingIntent
                );
            }
            
        } catch (Exception e) {
            Log.e(TAG, "Error scheduling alarm", e);
        }
    }
}
