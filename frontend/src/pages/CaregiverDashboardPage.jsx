import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';
import {
  ChevronLeft,
  User,
  Pill,
  CalendarDays,
  CheckCircle2,
  XCircle,
  Clock,
  Unlink,
  Bell,
  Loader2,
  ChevronRight,
  ChevronLeftIcon,
  SkipForward
} from 'lucide-react';
import BottomNav from '../components/BottomNav';
import apiService from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';

const CaregiverDashboardPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [patientData, setPatientData] = useState(null);
  const [medications, setMedications] = useState([]);
  const [adherenceLogs, setAdherenceLogs] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [notifyTaken, setNotifyTaken] = useState(true);
  const [notifyMissed, setNotifyMissed] = useState(true);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [unlinking, setUnlinking] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, []);

  // Initialize OneSignal Web Push for caregiver (browser users only)
  useEffect(() => {
    if (!user) return;
    const userId = user.id || user._id;
    if (!userId) return;

    // Dynamic import: only loads on web, never bundled eagerly on native
    import('@capacitor/core').then(({ Capacitor }) => {
      if (!Capacitor.isNativePlatform()) {
        import('../services/oneSignalWebService').then(({ default: svc }) => {
          svc.initAndLogin(userId).catch(err =>
            console.warn('[CaregiverDashboard] OneSignal web init:', err)
          );
        }).catch(() => {});
      }
    }).catch(() => {});
  }, [user?.id]);

  const loadDashboard = async () => {
    try {
      const data = await apiService.get('/api/caregiver/my-patient');
      if (!data.linked) {
        setPatientData(null);
        setLoading(false);
        return;
      }
      setPatientData(data.patient);
      setNotifyTaken(data.notify_on_taken);
      setNotifyMissed(data.notify_on_missed);

      // Get today in IST
      const now = new Date();
      const istOffset = 5.5 * 60 * 60 * 1000;
      const istDate = new Date(now.getTime() + istOffset + now.getTimezoneOffset() * 60 * 1000);
      const today = istDate.toISOString().split('T')[0];
      setSelectedDate(today);

      // Load medications and adherence
      const [meds, logs] = await Promise.all([
        apiService.get(`/api/caregiver/patient/${data.patient.id}/medications`),
        apiService.get(`/api/caregiver/patient/${data.patient.id}/adherence?date=${today}`)
      ]);
      setMedications(meds);
      setAdherenceLogs(logs);
    } catch (err) {
      console.error('Failed to load caregiver dashboard:', err);
      if (err.message === 'Unauthorized') return;
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadAdherenceForDate = useCallback(async (date) => {
    if (!patientData) return;
    try {
      const logs = await apiService.get(`/api/caregiver/patient/${patientData.id}/adherence?date=${date}`);
      setAdherenceLogs(logs);
    } catch (err) {
      console.error('Failed to load adherence:', err);
    }
  }, [patientData]);

  const changeDate = (offset) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + offset);
    const newDate = d.toISOString().split('T')[0];
    setSelectedDate(newDate);
    loadAdherenceForDate(newDate);
  };

  const handlePrefsUpdate = async (field, value) => {
    const newTaken = field === 'taken' ? value : notifyTaken;
    const newMissed = field === 'missed' ? value : notifyMissed;

    if (field === 'taken') setNotifyTaken(value);
    else setNotifyMissed(value);

    setSavingPrefs(true);
    try {
      await apiService.request('/api/caregiver/preferences', {
        method: 'PUT',
        body: JSON.stringify({ notify_on_taken: newTaken, notify_on_missed: newMissed })
      });
    } catch (err) {
      toast.error('Failed to update preferences');
      if (field === 'taken') setNotifyTaken(!value);
      else setNotifyMissed(!value);
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleUnlink = async () => {
    setUnlinking(true);
    try {
      await apiService.request('/api/caregiver/unlink', { method: 'DELETE' });
      toast.success('Unlinked from patient');
      setPatientData(null);
    } catch (err) {
      toast.error(err.message || 'Failed to unlink');
    } finally {
      setUnlinking(false);
    }
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  const statusIcon = (status) => {
    if (status === 'taken') return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
    if (status === 'missed') return <XCircle className="w-5 h-5 text-red-500" />;
    if (status === 'skipped') return <SkipForward className="w-5 h-5 text-amber-500" />;
    return <Clock className="w-5 h-5 text-amber-500" />;
  };

  if (loading) {
    return (
      <div className="pb-20 bg-gray-50 min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!patientData) {
    return (
      <div className="pb-20 bg-gray-50 min-h-screen">
        <div className="bg-white p-4 border-b sticky top-0 z-40">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/home')} className="p-2">
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-bold text-gray-900">Caregiver Dashboard</h1>
          </div>
        </div>
        <div className="p-4 text-center pt-20">
          <User className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-600">No Patient Linked</h3>
          <p className="text-gray-500 text-sm mt-1">You are not currently linked to any patient.</p>
        </div>
        <BottomNav active="home" />
      </div>
    );
  }

  const takenCount = adherenceLogs.filter(l => l.status === 'taken').length;
  const missedCount = adherenceLogs.filter(l => l.status === 'missed').length;
  const skippedCount = adherenceLogs.filter(l => l.status === 'skipped').length;
  const pendingCount = adherenceLogs.filter(l => l.status === 'pending').length;

  return (
    <div className="pb-20 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#1E3A5F] via-[#2BA89F] to-[#7AB648] p-4 sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/home')} className="text-white hover:bg-white/20 p-2" data-testid="back-btn">
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold text-white">Caregiver Dashboard</h1>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-lg mx-auto">
        {/* Patient Card */}
        <Card className="p-4" data-testid="patient-info-card">
          <div className="flex items-center gap-3">
            {patientData.picture ? (
              <img src={patientData.picture} alt={patientData.name} className="w-12 h-12 rounded-full" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                <User className="w-6 h-6 text-emerald-600" />
              </div>
            )}
            <div>
              <p className="font-bold text-gray-900">{patientData.name}</p>
              <p className="text-sm text-gray-500">
                {[patientData.age && `${patientData.age} yrs`, patientData.sex, patientData.diabetes_type].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>
        </Card>

        {/* Medications List */}
        <Card className="p-4" data-testid="medications-card">
          <div className="flex items-center gap-2 mb-3">
            <Pill className="w-5 h-5 text-emerald-600" />
            <h2 className="font-bold text-gray-900">Medications ({medications.length})</h2>
          </div>
          {medications.length === 0 ? (
            <p className="text-sm text-gray-500">No medications added yet.</p>
          ) : (
            <div className="space-y-2">
              {medications.map(med => (
                <div key={med.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{med.name}</p>
                    <p className="text-xs text-gray-500">{med.dosage} · {med.form}</p>
                  </div>
                  <p className="text-xs text-gray-400">
                    {med.schedule?.dosage_timings?.map(t => t.time).join(', ')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Date Selector + Adherence */}
        <Card className="p-4" data-testid="adherence-card">
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays className="w-5 h-5 text-emerald-600" />
            <h2 className="font-bold text-gray-900">Adherence</h2>
          </div>

          {/* Date Nav */}
          <div className="flex items-center justify-between mb-3 bg-gray-100 rounded-lg p-2">
            <button onClick={() => changeDate(-1)} className="p-1" data-testid="prev-date">
              <ChevronLeftIcon className="w-5 h-5 text-gray-600" />
            </button>
            <span className="text-sm font-medium text-gray-700">{formatDate(selectedDate)}</span>
            <button onClick={() => changeDate(1)} className="p-1" data-testid="next-date">
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-4 gap-2 mb-3">
            <div className="bg-emerald-50 rounded-lg p-2 text-center">
              <p className="text-lg font-bold text-emerald-600">{takenCount}</p>
              <p className="text-xs text-emerald-700">Taken</p>
            </div>
            <div className="bg-red-50 rounded-lg p-2 text-center">
              <p className="text-lg font-bold text-red-600">{missedCount}</p>
              <p className="text-xs text-red-700">Missed</p>
            </div>
            <div className="bg-orange-50 rounded-lg p-2 text-center">
              <p className="text-lg font-bold text-orange-500">{skippedCount}</p>
              <p className="text-xs text-orange-600">Skipped</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-2 text-center">
              <p className="text-lg font-bold text-amber-600">{pendingCount}</p>
              <p className="text-xs text-amber-700">Pending</p>
            </div>
          </div>

          {/* Log List */}
          {adherenceLogs.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No medication logs for this date.</p>
          ) : (
            <div className="space-y-2">
              {adherenceLogs.map(log => (
                <div key={log.id} className="flex items-center gap-3 py-2 border-b last:border-0">
                  {statusIcon(log.status)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{log.medication_name || 'Unknown'}</p>
                    <p className="text-xs text-gray-500">{log.medication_dosage} · Scheduled {log.scheduled_time}</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    log.status === 'taken' ? 'bg-emerald-100 text-emerald-700' :
                    log.status === 'missed' ? 'bg-red-100 text-red-700' :
                    log.status === 'skipped' ? 'bg-orange-100 text-orange-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {log.status === 'taken' && log.taken_time ? log.taken_time : log.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Notification Preferences */}
        <Card className="p-4" data-testid="preferences-card">
          <div className="flex items-center gap-2 mb-3">
            <Bell className="w-5 h-5 text-emerald-600" />
            <h2 className="font-bold text-gray-900">Notification Preferences</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm text-gray-700">Notify when medicine is taken</Label>
              <Switch
                checked={notifyTaken}
                onCheckedChange={v => handlePrefsUpdate('taken', v)}
                disabled={savingPrefs}
                data-testid="notify-taken-switch"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm text-gray-700">Notify when medicine is missed</Label>
              <Switch
                checked={notifyMissed}
                onCheckedChange={v => handlePrefsUpdate('missed', v)}
                disabled={savingPrefs}
                data-testid="notify-missed-switch"
              />
            </div>
          </div>
        </Card>

        {/* Unlink */}
        <Button
          variant="outline"
          className="w-full text-red-600 border-red-200 hover:bg-red-50"
          onClick={handleUnlink}
          disabled={unlinking}
          data-testid="unlink-btn"
        >
          {unlinking ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Unlink className="w-4 h-4 mr-2" />}
          Unlink from Patient
        </Button>
      </div>

      <BottomNav active="home" />
    </div>
  );
};

export default CaregiverDashboardPage;
