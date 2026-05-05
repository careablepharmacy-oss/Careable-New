import React, { useState, useEffect } from 'react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Bell, RefreshCw, Trash2, AlertTriangle, CheckCircle } from 'lucide-react';
import capacitorNotificationService from '../services/capacitorNotifications';
import notificationManager from '../services/notificationManager';
import apiService from '../services/api';

const DeveloperTestingPanel = () => {
  const [alarmCount, setAlarmCount] = useState(0);
  const [daysAhead, setDaysAhead] = useState(0);
  const [nextCheckTime, setNextCheckTime] = useState('N/A');
  const [environment, setEnvironment] = useState('unknown');
  const [testResult, setTestResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pendingAlarms, setPendingAlarms] = useState([]);

  useEffect(() => {
    loadAlarmStats();
    setEnvironment(notificationManager.environment);
  }, []);

  const loadAlarmStats = async () => {
    try {
      const pending = await capacitorNotificationService.getPendingNotifications();
      const count = pending.notifications?.length || 0;
      setAlarmCount(count);
      setPendingAlarms(pending.notifications || []);

      // Calculate days/minutes ahead
      if (count > 0 && pending.notifications.length > 0) {
        const furthestAlarm = pending.notifications.reduce((latest, alarm) => {
          const alarmTime = new Date(alarm.schedule.at).getTime();
          const latestTime = new Date(latest.schedule.at).getTime();
          return alarmTime > latestTime ? alarm : latest;
        });

        const now = Date.now();
        const furthestTime = new Date(furthestAlarm.schedule.at).getTime();
        const diffMs = furthestTime - now;

        if (notificationManager.environment === 'testing') {
          const minutes = Math.floor(diffMs / (60 * 1000));
          setDaysAhead(`${minutes} minutes`);
        } else {
          const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
          setDaysAhead(`${days} days`);
        }
      } else {
        setDaysAhead('0');
      }
    } catch (error) {
      console.error('Error loading alarm stats:', error);
    }
  };

  const handleForceReschedule = async () => {
    setLoading(true);
    setTestResult(null);
    try {
      const rescheduled = await notificationManager.checkAndRescheduleIfNeeded();
      await loadAlarmStats();
      setTestResult({
        success: true,
        message: rescheduled
          ? 'Re-scheduling completed successfully'
          : 'No re-scheduling needed (alarm count is healthy)'
      });
    } catch (error) {
      setTestResult({
        success: false,
        message: `Error: ${error.message}`
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClearAllAlarms = async () => {
    if (!window.confirm('Clear ALL alarms? This cannot be undone!')) {
      return;
    }

    setLoading(true);
    setTestResult(null);
    try {
      await capacitorNotificationService.cancelAll();
      await loadAlarmStats();
      setTestResult({
        success: true,
        message: 'All alarms cleared successfully'
      });
    } catch (error) {
      setTestResult({
        success: false,
        message: `Error: ${error.message}`
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateLowAlarms = async () => {
    setLoading(true);
    setTestResult(null);
    try {
      // Clear all alarms first
      await capacitorNotificationService.cancelAll();

      // Create a test medication with one alarm
      const testMed = {
        id: 'test-low-alarm',
        name: 'Test Low Alarm',
        dosage: '1 tablet',
        schedule: {
          frequency: 'daily',
          times: ['10:00']
        }
      };

      // Schedule just one alarm (2 minutes from now)
      const now = new Date();
      const alarmTime = new Date(now.getTime() + 2 * 60 * 1000);
      await capacitorNotificationService.scheduleNotifications([
        {
          id: 999,
          title: `Time to take ${testMed.name}`,
          body: testMed.dosage,
          schedule: { at: alarmTime }
        }
      ]);

      await loadAlarmStats();
      setTestResult({
        success: true,
        message: 'Low alarm condition simulated (1 alarm scheduled for 2 minutes from now)'
      });
    } catch (error) {
      setTestResult({
        success: false,
        message: `Error: ${error.message}`
      });
    } finally {
      setLoading(false);
    }
  };

  const formatAlarmTime = (scheduleAt) => {
    const date = new Date(scheduleAt);
    if (notificationManager.environment === 'testing') {
      return date.toLocaleTimeString();
    }
    return date.toLocaleString();
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Developer Testing Panel</h2>
          <div
            className={`px-3 py-1 rounded-full text-sm font-medium ${
              environment === 'testing'
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-green-100 text-green-800'
            }`}
          >
            {environment.toUpperCase()} MODE
          </div>
        </div>

        {environment === 'testing' && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>Testing Mode Active:</strong> Alarms scheduled 5 minutes ahead with
              2-minute intervals. Perfect for quick validation!
            </p>
          </div>
        )}

        {/* Current Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="p-4 bg-blue-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Alarms Scheduled</p>
                <p className="text-3xl font-bold text-blue-600">{alarmCount}</p>
              </div>
              <Bell className="w-8 h-8 text-blue-400" />
            </div>
          </Card>

          <Card className="p-4 bg-green-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">
                  {environment === 'testing' ? 'Minutes' : 'Days'} Ahead
                </p>
                <p className="text-3xl font-bold text-green-600">{daysAhead}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
          </Card>

          <Card className="p-4 bg-purple-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Next Check</p>
                <p className="text-lg font-bold text-purple-600">{nextCheckTime}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-purple-400" />
            </div>
          </Card>
        </div>

        {/* Test Result */}
        {testResult && (
          <div
            className={`mb-6 p-4 rounded-lg border ${
              testResult.success
                ? 'bg-green-50 border-green-200'
                : 'bg-red-50 border-red-200'
            }`}
          >
            <p
              className={`text-sm ${
                testResult.success ? 'text-green-800' : 'text-red-800'
              }`}
            >
              {testResult.message}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Button
            onClick={loadAlarmStats}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh Stats
          </Button>

          <Button
            onClick={handleForceReschedule}
            disabled={loading}
            variant="outline"
            className="w-full flex items-center justify-center gap-2"
          >
            <Bell className="w-4 h-4" />
            Force Re-schedule Check
          </Button>

          <Button
            onClick={handleSimulateLowAlarms}
            disabled={loading}
            variant="outline"
            className="w-full flex items-center justify-center gap-2"
          >
            <AlertTriangle className="w-4 h-4" />
            Simulate Low Alarms
          </Button>

          <Button
            onClick={handleClearAllAlarms}
            disabled={loading}
            variant="destructive"
            className="w-full flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Clear All Alarms
          </Button>
        </div>

        {/* Pending Alarms List */}
        <div>
          <h3 className="text-lg font-semibold mb-3">
            Pending Alarms ({pendingAlarms.length})
          </h3>
          <div className="max-h-64 overflow-y-auto">
            {pendingAlarms.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No alarms scheduled</p>
            ) : (
              <div className="space-y-2">
                {pendingAlarms.slice(0, 10).map((alarm, index) => (
                  <div
                    key={index}
                    className="p-3 bg-gray-50 rounded border border-gray-200 text-sm"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">{alarm.title}</p>
                        <p className="text-gray-600">{alarm.body}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">
                          {formatAlarmTime(alarm.schedule.at)}
                        </p>
                        <p className="text-xs text-gray-400">ID: {alarm.id}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {pendingAlarms.length > 10 && (
                  <p className="text-center text-gray-500 py-2">
                    ... and {pendingAlarms.length - 10} more
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Testing Instructions */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold mb-2">Testing Protocol:</h3>
          <ol className="text-sm text-gray-700 space-y-1 list-decimal list-inside">
            <li>Check current alarm count and time ahead</li>
            <li>Click "Simulate Low Alarms" to test re-scheduling</li>
            <li>Wait 2 minutes for alarm to fire</li>
            <li>Open app and click "Force Re-schedule Check"</li>
            <li>Verify new alarms were scheduled</li>
            <li>Check logs for re-scheduling events</li>
          </ol>
        </div>
      </Card>
    </div>
  );
};

export default DeveloperTestingPanel;
