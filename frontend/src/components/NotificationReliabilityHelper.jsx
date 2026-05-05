/**
 * NotificationReliabilityHelper Component
 * 
 * A non-blocking helper screen that guides users to optimize notification reliability.
 * Shows only when needed and can be skipped.
 * 
 * Features:
 * - Battery optimization settings shortcut
 * - Notification settings shortcut
 * - Skip option (non-mandatory)
 */

import React, { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { AlertCircle, Battery, Bell, Check, ChevronRight, X } from 'lucide-react';
import storageService from '../services/storageService';

const NotificationReliabilityHelper = ({ onComplete, onSkip }) => {
  const [isNative, setIsNative] = useState(false);
  const [batteryOptimizationDone, setBatteryOptimizationDone] = useState(false);
  const [notificationSettingsDone, setNotificationSettingsDone] = useState(false);

  useEffect(() => {
    setIsNative(Capacitor.isNativePlatform());
  }, []);

  // Don't show on web
  if (!isNative) {
    onComplete?.();
    return null;
  }

  const openBatterySettings = async () => {
    try {
      // Try to open battery optimization settings
      // This uses Android's Intent system via a custom URL scheme
      const { App } = await import('@capacitor/app');
      
      // For Android, we can try to open the battery optimization settings
      // Note: This may not work on all devices, fallback is general settings
      if (Capacitor.getPlatform() === 'android') {
        try {
          // Try to open app's battery settings directly
          await App.openUrl({ url: 'package:com.diabexpert.app' });
        } catch {
          // Fallback: Open general settings
          await App.openUrl({ url: 'app-settings:' });
        }
      }
      
      setBatteryOptimizationDone(true);
      await storageService.setItem('batteryOptimizationChecked', 'true');
    } catch (error) {
      console.log('Could not open battery settings:', error);
      setBatteryOptimizationDone(true);
    }
  };

  const openNotificationSettings = async () => {
    try {
      const { App } = await import('@capacitor/app');
      await App.openUrl({ url: 'app-settings:' });
      setNotificationSettingsDone(true);
      await storageService.setItem('notificationSettingsChecked', 'true');
    } catch (error) {
      console.log('Could not open notification settings:', error);
      setNotificationSettingsDone(true);
    }
  };

  const handleComplete = async () => {
    await storageService.setItem('reliabilityHelperShown', 'true');
    onComplete?.();
  };

  const handleSkip = async () => {
    await storageService.setItem('reliabilityHelperSkipped', 'true');
    onSkip?.();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-white">
        <CardHeader className="relative">
          <button 
            onClick={handleSkip}
            className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
            aria-label="Skip"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-full">
              <Bell className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-lg">Improve Reminder Reliability</CardTitle>
          </div>
          <CardDescription>
            To ensure your medication reminders work reliably, please adjust these settings.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Battery Optimization */}
          <div 
            onClick={openBatterySettings}
            className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-colors ${
              batteryOptimizationDone 
                ? 'bg-green-50 border-green-200' 
                : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${
                batteryOptimizationDone ? 'bg-green-100' : 'bg-orange-100'
              }`}>
                {batteryOptimizationDone ? (
                  <Check className="h-5 w-5 text-green-600" />
                ) : (
                  <Battery className="h-5 w-5 text-orange-600" />
                )}
              </div>
              <div>
                <p className="font-medium text-sm">Battery Optimization</p>
                <p className="text-xs text-gray-500">
                  Allow Careable 360+ to run without restrictions
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-gray-400" />
          </div>

          {/* Notification Settings */}
          <div 
            onClick={openNotificationSettings}
            className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-colors ${
              notificationSettingsDone 
                ? 'bg-green-50 border-green-200' 
                : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${
                notificationSettingsDone ? 'bg-green-100' : 'bg-blue-100'
              }`}>
                {notificationSettingsDone ? (
                  <Check className="h-5 w-5 text-green-600" />
                ) : (
                  <Bell className="h-5 w-5 text-blue-600" />
                )}
              </div>
              <div>
                <p className="font-medium text-sm">Notification Settings</p>
                <p className="text-xs text-gray-500">
                  Ensure notifications are enabled
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-gray-400" />
          </div>

          {/* Info Note */}
          <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg">
            <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-800">
              These settings help ensure your medication reminders are delivered on time, 
              even when the app is in the background.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button 
              variant="outline" 
              onClick={handleSkip}
              className="flex-1"
            >
              Skip for now
            </Button>
            <Button 
              onClick={handleComplete}
              className="flex-1"
              disabled={!batteryOptimizationDone && !notificationSettingsDone}
            >
              Done
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default NotificationReliabilityHelper;
