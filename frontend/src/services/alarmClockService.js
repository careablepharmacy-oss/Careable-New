/**
 * Alarm Clock Service
 * 
 * Uses Android's native AlarmClock to set medication alarms
 * This provides real alarm experience with looping sound and vibration
 */

import { Capacitor } from '@capacitor/core';
import { registerPlugin } from '@capacitor/core';

// Register the AlarmClock plugin
const AlarmClock = registerPlugin('AlarmClock');

const TAG = '[AlarmClockService]';

/**
 * Check if running on native platform
 */
export const isNative = () => {
  return Capacitor.isNativePlatform();
};

/**
 * Set an alarm using Android's AlarmClock
 * 
 * @param {number} hour - Hour (0-23)
 * @param {number} minute - Minute (0-59)
 * @param {string} message - Alarm message/label
 * @returns {Promise<boolean>} Success status
 */
export const setAlarm = async (hour, minute, message) => {
  console.log(`${TAG} Setting alarm for ${hour}:${minute} - ${message}`);
  
  if (!isNative()) {
    console.warn(`${TAG} Not on native platform, cannot set alarm`);
    return false;
  }
  
  try {
    const result = await AlarmClock.setAlarm({
      hour: hour,
      minute: minute,
      message: message
    });
    
    console.log(`${TAG} Alarm set successfully:`, result);
    return true;
  } catch (error) {
    console.error(`${TAG} Error setting alarm:`, error);
    return false;
  }
};

/**
 * Set medication alarm
 * 
 * @param {Object} medication - Medication object
 * @param {string} time - Time in HH:MM format (IST)
 * @returns {Promise<boolean>} Success status
 */
export const setMedicationAlarm = async (medication, time) => {
  console.log(`${TAG} Setting medication alarm...`);
  console.log(`${TAG} Medication:`, medication.name);
  console.log(`${TAG} Time (IST):`, time);
  
  if (!isNative()) {
    console.warn(`${TAG} Not on native platform`);
    return false;
  }
  
  try {
    // Parse time (HH:MM)
    const [hours, minutes] = time.split(':').map(Number);
    
    if (isNaN(hours) || isNaN(minutes)) {
      console.error(`${TAG} Invalid time format:`, time);
      return false;
    }
    
    // Create alarm message
    const message = `💊 ${medication.name} - ${medication.dosage}`;
    
    // Set the alarm
    const success = await setAlarm(hours, minutes, message);
    
    if (success) {
      console.log(`${TAG} ✅ Medication alarm set for ${hours}:${minutes} IST`);
    } else {
      console.error(`${TAG} ❌ Failed to set medication alarm`);
    }
    
    return success;
  } catch (error) {
    console.error(`${TAG} Error in setMedicationAlarm:`, error);
    return false;
  }
};

/**
 * Set alarms for all medication times
 * 
 * @param {Object} medication - Medication object with schedule
 * @returns {Promise<number>} Number of alarms set
 */
export const setMedicationAlarms = async (medication) => {
  console.log(`${TAG} Setting alarms for medication:`, medication.name);
  
  if (!medication.schedule || !medication.schedule.times || medication.schedule.times.length === 0) {
    console.error(`${TAG} No times in medication schedule`);
    return 0;
  }
  
  let alarmsSet = 0;
  
  for (const time of medication.schedule.times) {
    const success = await setMedicationAlarm(medication, time);
    if (success) {
      alarmsSet++;
    }
  }
  
  console.log(`${TAG} ✅ Set ${alarmsSet} alarms for ${medication.name}`);
  return alarmsSet;
};

export default {
  isNative,
  setAlarm,
  setMedicationAlarm,
  setMedicationAlarms
};
