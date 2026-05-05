import React, { useState, useEffect } from 'react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Separator } from '../components/ui/separator';
import { Avatar, AvatarImage, AvatarFallback } from '../components/ui/avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import {
  ArrowLeft, Bell, Shield, HelpCircle, Mail, Phone, LogOut, ChevronRight,
  User, Lock, Download, Info, Loader2, Send, AlarmClock, UserPlus,
  Package, Settings as SettingsIcon, LifeBuoy
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from '../hooks/use-toast';
import InstallPWA from '../components/InstallPWA';
import OrdersList from '../components/OrdersList';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';
import { Capacitor } from '@capacitor/core';
import storageService from '../services/storageService';
import capacitorNotificationService from '../services/capacitorNotifications';
import notificationManager from '../services/notificationManager';

const SectionHeader = ({ icon: Icon, title, subtitle }) => (
  <div className="flex items-start gap-3 mb-4">
    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2BA89F] to-[#1E3A5F] flex items-center justify-center shadow-sm shrink-0">
      <Icon className="w-5 h-5 text-white" />
    </div>
    <div>
      <h3 className="text-base font-semibold text-gray-900 leading-tight">{title}</h3>
      {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
    </div>
  </div>
);

const ProfilePage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [testPushLoading, setTestPushLoading] = useState(false);
  const [pushDebugInfo, setPushDebugInfo] = useState(null);
  const [localAlarmsEnabled, setLocalAlarmsEnabled] = useState(false);
  const [localAlarmsLoading, setLocalAlarmsLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [profile, setProfile] = useState({
    name: '', email: '', phone: '', sex: '', age: '', address: '',
    state: '', country: '', pincode: '', diabetesType: 'Type 2',
    relativeName: '', relativeEmail: '', relativeWhatsapp: ''
  });

  const [notifications, setNotifications] = useState({
    medicationReminders: true,
    appointmentReminders: true,
    healthTips: false,
    emailNotifications: true,
    pushNotifications: true
  });

  useEffect(() => {
    if (user) {
      setProfile({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        sex: user.sex || '',
        age: user.age || '',
        address: user.address || '',
        state: user.state || '',
        country: user.country || '',
        pincode: user.pincode || '',
        diabetesType: user.diabetes_type || 'Type 2',
        relativeName: user.relative_name || '',
        relativeEmail: user.relative_email || '',
        relativeWhatsapp: user.relative_whatsapp || ''
      });
    }
  }, [user]);

  useEffect(() => {
    const loadNotificationSettings = async () => {
      try {
        const settings = await apiService.getNotificationSettings();
        const alarmEnabled = settings.alarm_enabled === true;
        setLocalAlarmsEnabled(alarmEnabled);
        await storageService.setItem('local_alarms_enabled', alarmEnabled.toString());
        setNotifications({
          medicationReminders: settings.medication_reminders !== false,
          appointmentReminders: settings.appointment_reminders !== false,
          healthTips: settings.health_tips === true,
          emailNotifications: settings.email_notifications !== false,
          pushNotifications: settings.push_notifications !== false
        });
      } catch (error) {
        console.error('Failed to load notification settings from backend:', error);
        setLocalAlarmsEnabled(false);
      }
    };
    loadNotificationSettings();
  }, []);

  const handleSaveProfile = async () => {
    setSaveLoading(true);
    try {
      const updateData = {
        name: profile.name,
        phone: profile.phone,
        sex: profile.sex,
        age: profile.age ? parseInt(profile.age) : null,
        address: profile.address,
        state: profile.state,
        country: profile.country,
        pincode: profile.pincode,
        diabetes_type: profile.diabetesType,
        relative_name: profile.relativeName,
        relative_email: profile.relativeEmail,
        relative_whatsapp: profile.relativeWhatsapp
      };
      await apiService.updateUserProfile(updateData);
      toast({ title: 'Success!', description: 'Profile updated successfully' });
    } catch (error) {
      console.error('Failed to update profile:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update profile. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setSaveLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Logout failed:', error);
      navigate('/');
    }
  };

  const handleContactSupport = () => {
    window.open('mailto:support@diabexpert.online');
  };

  const handleLocalAlarmsToggle = async (enabled) => {
    setLocalAlarmsLoading(true);
    try {
      await apiService.updateNotificationSettings({ alarm_enabled: enabled });
      await storageService.setItem('local_alarms_enabled', enabled.toString());
      setLocalAlarmsEnabled(enabled);

      if (Capacitor.isNativePlatform()) {
        if (enabled) {
          await notificationManager.rescheduleAllMedications();
        } else {
          await capacitorNotificationService.cancelAllNotifications();
        }
      }

      toast({
        title: enabled ? 'Alarm Enabled' : 'Alarm Disabled',
        description: enabled
          ? 'Device alarm will ring along with push notifications for medication reminders'
          : 'You will still receive push notifications for medication reminders',
      });
    } catch (error) {
      console.error('Failed to toggle alarm setting:', error);
      toast({
        title: 'Error',
        description: 'Failed to update alarm settings. Please try again.',
        variant: 'destructive'
      });
      setLocalAlarmsEnabled(!enabled);
    } finally {
      setLocalAlarmsLoading(false);
    }
  };

  const handleTestPush = async () => {
    setTestPushLoading(true);
    try {
      const debugResponse = await apiService.get('/api/notifications/debug-info');
      setPushDebugInfo(debugResponse);
      const response = await apiService.post('/api/notifications/test-onesignal');
      if (response.success) {
        toast({
          title: 'Test Notification Sent!',
          description: `Notification sent to user. Recipients: ${response.recipients || 0}`,
        });
      } else {
        toast({
          title: 'Push Failed',
          description: response.error || 'Failed to send test notification',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Test push error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to send test notification',
        variant: 'destructive'
      });
    } finally {
      setTestPushLoading(false);
    }
  };

  const updateNotificationToggle = async (key, field, checked) => {
    setNotifications(prev => ({ ...prev, [key]: checked }));
    try {
      await apiService.updateNotificationSettings({ [field]: checked });
    } catch (e) {
      setNotifications(prev => ({ ...prev, [key]: !checked }));
    }
  };

  const tabs = [
    { value: 'profile', label: 'Profile', icon: User },
    { value: 'orders', label: 'Orders', icon: Package },
    { value: 'settings', label: 'Settings', icon: SettingsIcon },
    { value: 'help', label: 'Help', icon: LifeBuoy },
  ];

  return (
    <div className="pb-10 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#1E3A5F] via-[#2BA89F] to-[#7AB648] px-5 pt-6 pb-10 rounded-b-3xl shadow-lg">
        <div className="flex items-center gap-3 mb-5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/home')}
            className="h-9 w-9 p-0 text-white hover:bg-white/20 rounded-full"
            data-testid="profile-back-btn"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold text-white tracking-tight">Profile & Settings</h1>
        </div>

        <div className="flex items-center gap-4">
          <Avatar className="w-16 h-16 border-2 border-white/80 shadow-md">
            <AvatarImage src={user?.picture} alt={profile.name} />
            <AvatarFallback className="bg-white text-emerald-700 text-xl font-bold">
              {profile.name ? profile.name.charAt(0).toUpperCase() : 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-white truncate">{profile.name || 'Welcome'}</h2>
            <p className="text-emerald-50/90 text-xs truncate">{profile.email}</p>
            {profile.phone && (
              <p className="text-emerald-50/70 text-xs truncate mt-0.5">{profile.phone}</p>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 -mt-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList
            className="w-full h-auto grid grid-cols-4 gap-1 p-1.5 bg-white rounded-2xl shadow-lg border border-gray-100"
            data-testid="profile-tabs-list"
          >
            {tabs.map(({ value, label, icon: Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl text-[11px] font-medium text-gray-500 data-[state=active]:bg-gradient-to-br data-[state=active]:from-[#2BA89F] data-[state=active]:to-[#1E3A5F] data-[state=active]:text-white data-[state=active]:shadow-md transition-all"
                data-testid={`profile-tab-${value}`}
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Tab 1: My Profile */}
          <TabsContent value="profile" className="mt-4 space-y-4 focus-visible:ring-0">
            <Card className="p-5 border-gray-100 shadow-sm">
              <SectionHeader icon={User} title="Account Information" subtitle="Your personal details" />
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name" className="text-xs font-medium text-gray-700">Full Name</Label>
                  <Input
                    id="name"
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    className="mt-1.5"
                    data-testid="profile-name-input"
                  />
                </div>
                <div>
                  <Label htmlFor="email" className="text-xs font-medium text-gray-700">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profile.email}
                    className="mt-1.5 bg-gray-50"
                    disabled
                    data-testid="profile-email-input"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">Email cannot be changed</p>
                </div>
                <div>
                  <Label htmlFor="phone" className="text-xs font-medium text-gray-700">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={profile.phone}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    className="mt-1.5"
                    data-testid="profile-phone-input"
                  />
                </div>
                <Button
                  onClick={handleSaveProfile}
                  disabled={saveLoading}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 shadow-sm"
                  data-testid="profile-save-btn"
                >
                  {saveLoading ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
                  ) : 'Save Changes'}
                </Button>
              </div>
            </Card>

            <Card className="p-5 border-gray-100 shadow-sm">
              <SectionHeader icon={UserPlus} title="Relative Information" subtitle="Emergency contact & caregiver" />
              <div className="space-y-4">
                <div>
                  <Label htmlFor="relativeName" className="text-xs font-medium text-gray-700">Relative's Name</Label>
                  <Input
                    id="relativeName"
                    value={profile.relativeName}
                    onChange={(e) => setProfile({ ...profile, relativeName: e.target.value })}
                    className="mt-1.5"
                    placeholder="Enter relative's full name"
                    data-testid="relative-name-input"
                  />
                </div>
                <div>
                  <Label htmlFor="relativeEmail" className="text-xs font-medium text-gray-700">Relative's Email</Label>
                  <Input
                    id="relativeEmail"
                    type="email"
                    value={profile.relativeEmail}
                    onChange={(e) => setProfile({ ...profile, relativeEmail: e.target.value })}
                    className="mt-1.5"
                    placeholder="relative@example.com"
                    data-testid="relative-email-input"
                  />
                </div>
                <div>
                  <Label htmlFor="relativeWhatsapp" className="text-xs font-medium text-gray-700">Relative's WhatsApp Number</Label>
                  <Input
                    id="relativeWhatsapp"
                    type="tel"
                    value={profile.relativeWhatsapp}
                    onChange={(e) => setProfile({ ...profile, relativeWhatsapp: e.target.value })}
                    className="mt-1.5"
                    placeholder="+91 98765 43210"
                    data-testid="relative-whatsapp-input"
                  />
                </div>
                <div
                  className="flex items-center justify-between p-3 rounded-xl bg-blue-50 border border-blue-100 cursor-pointer hover:bg-blue-100 transition-colors"
                  onClick={() => {
                    const phone = profile.relativeWhatsapp?.replace(/\D/g, '').slice(-10);
                    navigate(`/caregiver-invite${phone ? `?phone=${phone}` : ''}`);
                  }}
                  data-testid="manage-caregiver-btn"
                >
                  <div className="flex items-center gap-3">
                    <UserPlus className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="text-sm font-medium text-blue-900">Manage Caregiver</p>
                      <p className="text-xs text-blue-700">Invite or view your linked caregiver</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-blue-400" />
                </div>
                <Button
                  onClick={handleSaveProfile}
                  disabled={saveLoading}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 shadow-sm"
                  data-testid="relative-save-btn"
                >
                  {saveLoading ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
                  ) : 'Save Changes'}
                </Button>
              </div>
            </Card>

            <Button
              onClick={handleLogout}
              variant="outline"
              className="w-full text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
              data-testid="logout-btn"
            >
              <LogOut className="w-5 h-5 mr-2" />
              Sign Out
            </Button>
          </TabsContent>

          {/* Tab 2: My Orders */}
          <TabsContent value="orders" className="mt-4 focus-visible:ring-0">
            <Card className="p-5 border-gray-100 shadow-sm">
              <SectionHeader icon={Package} title="My Orders" subtitle="Product, Medicine & Injection orders" />
              <OrdersList />
            </Card>
          </TabsContent>

          {/* Tab 3: Settings */}
          <TabsContent value="settings" className="mt-4 space-y-4 focus-visible:ring-0">
            <Card className="p-5 border-gray-100 shadow-sm">
              <SectionHeader icon={Bell} title="Notifications" subtitle="Manage how you get notified" />
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 pr-3">
                    <p className="font-medium text-gray-900 text-sm">Medication Reminders</p>
                    <p className="text-xs text-gray-500">Get notified about medication doses</p>
                  </div>
                  <Switch
                    checked={notifications.medicationReminders}
                    onCheckedChange={(c) => updateNotificationToggle('medicationReminders', 'medication_reminders', c)}
                    data-testid="medication-reminders-toggle"
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="flex-1 pr-3">
                    <p className="font-medium text-gray-900 text-sm">Appointment Reminders</p>
                    <p className="text-xs text-gray-500">Doctor visits and lab tests</p>
                  </div>
                  <Switch
                    checked={notifications.appointmentReminders}
                    onCheckedChange={(c) => updateNotificationToggle('appointmentReminders', 'appointment_reminders', c)}
                    data-testid="appointment-reminders-toggle"
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="flex-1 pr-3">
                    <p className="font-medium text-gray-900 text-sm">Health Tips</p>
                    <p className="text-xs text-gray-500">Daily diabetes care tips</p>
                  </div>
                  <Switch
                    checked={notifications.healthTips}
                    onCheckedChange={(c) => updateNotificationToggle('healthTips', 'health_tips', c)}
                    data-testid="health-tips-toggle"
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="flex-1 pr-3">
                    <p className="font-medium text-gray-900 text-sm">Push Notifications</p>
                    <p className="text-xs text-gray-500">Receive notifications on device</p>
                  </div>
                  <Switch
                    checked={notifications.pushNotifications}
                    onCheckedChange={(c) => updateNotificationToggle('pushNotifications', 'push_notifications', c)}
                    data-testid="push-notifications-toggle"
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="flex-1 pr-3">
                    <p className="font-medium text-gray-900 text-sm">Email Notifications</p>
                    <p className="text-xs text-gray-500">Receive updates via email</p>
                  </div>
                  <Switch
                    checked={notifications.emailNotifications}
                    onCheckedChange={(c) => updateNotificationToggle('emailNotifications', 'email_notifications', c)}
                    data-testid="email-notifications-toggle"
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="flex-1 pr-3">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 text-sm">Medication Alarm</p>
                      <AlarmClock className="w-4 h-4 text-emerald-600" />
                    </div>
                    <p className="text-xs text-gray-500">
                      {localAlarmsEnabled
                        ? 'Alarm sound will ring on your device for reminders'
                        : 'Only push notifications will be sent (no alarm sound)'}
                    </p>
                  </div>
                  <Switch
                    checked={localAlarmsEnabled}
                    onCheckedChange={handleLocalAlarmsToggle}
                    disabled={localAlarmsLoading}
                    data-testid="alarm-toggle"
                  />
                </div>
                {localAlarmsLoading && (
                  <div className="flex items-center justify-center py-2">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-600 mr-2" />
                    <span className="text-xs text-gray-500">
                      {localAlarmsEnabled ? 'Scheduling alarms...' : 'Cancelling alarms...'}
                    </span>
                  </div>
                )}
              </div>
            </Card>

            {Capacitor.isNativePlatform() && (
              <Card className="p-5 border-gray-100 shadow-sm">
                <SectionHeader icon={Send} title="Test Push Notifications" subtitle="Verify notifications work on this device" />
                <Button
                  onClick={handleTestPush}
                  disabled={testPushLoading}
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                  data-testid="test-push-btn"
                >
                  {testPushLoading ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending...</>
                  ) : (
                    <><Bell className="w-4 h-4 mr-2" />Send Test Notification</>
                  )}
                </Button>
                {pushDebugInfo && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg text-xs border border-gray-100">
                    <p className="font-semibold mb-2 text-gray-700">Debug Info</p>
                    <p><span className="text-gray-500">User ID:</span> {pushDebugInfo.user_id}</p>
                    <p><span className="text-gray-500">OneSignal:</span> {pushDebugInfo.onesignal_configured ? 'Configured' : 'Not configured'}</p>
                    <p className="truncate"><span className="text-gray-500">App ID:</span> {pushDebugInfo.onesignal_app_id}</p>
                  </div>
                )}
              </Card>
            )}

            <Card className="p-5 border-gray-100 shadow-sm">
              <SectionHeader icon={Download} title="App" subtitle="Install and manage the app" />
              <button
                onClick={() => setShowInstallPrompt(true)}
                className="w-full flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition-colors"
                data-testid="install-app-btn"
              >
                <div className="flex items-center gap-3">
                  <Download className="w-5 h-5 text-gray-600" />
                  <div className="text-left">
                    <p className="font-medium text-gray-900 text-sm">Install App</p>
                    <p className="text-xs text-gray-500">Add Careable 360+ to home screen</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </button>
            </Card>
          </TabsContent>

          {/* Tab 4: Help & Support */}
          <TabsContent value="help" className="mt-4 space-y-4 focus-visible:ring-0">
            <Card className="p-5 border-gray-100 shadow-sm">
              <SectionHeader icon={Shield} title="Privacy & Security" subtitle="Policies and legal info" />
              <div className="space-y-1">
                <button
                  onClick={() => navigate('/privacy-policy')}
                  className="w-full flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition-colors"
                  data-testid="privacy-policy-btn"
                >
                  <div className="flex items-center gap-3">
                    <Lock className="w-5 h-5 text-gray-600" />
                    <div className="text-left">
                      <p className="font-medium text-gray-900 text-sm">Privacy Policy</p>
                      <p className="text-xs text-gray-500">View our privacy policy</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>
                <Separator />
                <button
                  onClick={() => navigate('/terms')}
                  className="w-full flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition-colors"
                  data-testid="terms-btn"
                >
                  <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-gray-600" />
                    <div className="text-left">
                      <p className="font-medium text-gray-900 text-sm">Terms of Service</p>
                      <p className="text-xs text-gray-500">Read our terms</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>
                <Separator />
                <button
                  onClick={() => navigate('/about')}
                  className="w-full flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition-colors"
                  data-testid="about-btn"
                >
                  <div className="flex items-center gap-3">
                    <Info className="w-5 h-5 text-blue-600" />
                    <div className="text-left">
                      <p className="font-medium text-gray-900 text-sm">About & Version</p>
                      <p className="text-xs text-gray-500">App version and information</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </Card>

            <Card className="p-5 border-gray-100 shadow-sm">
              <SectionHeader icon={HelpCircle} title="Help & Support" subtitle="We're here to help you" />
              <div className="space-y-1">
                <button
                  onClick={handleContactSupport}
                  className="w-full flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition-colors"
                  data-testid="email-support-btn"
                >
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-gray-600" />
                    <div className="text-left">
                      <p className="font-medium text-gray-900 text-sm">Email Support</p>
                      <p className="text-xs text-gray-500">support@diabexpert.online</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>
                <Separator />
                <button
                  onClick={() => window.open('tel:+919422799196')}
                  className="w-full flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition-colors"
                  data-testid="phone-support-btn"
                >
                  <div className="flex items-center gap-3">
                    <Phone className="w-5 h-5 text-gray-600" />
                    <div className="text-left">
                      <p className="font-medium text-gray-900 text-sm">Phone Support</p>
                      <p className="text-xs text-gray-500">+91 9422799196</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>
                <Separator />
                <button
                  onClick={() => navigate('/faq')}
                  className="w-full flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition-colors"
                  data-testid="faq-btn"
                >
                  <div className="flex items-center gap-3">
                    <HelpCircle className="w-5 h-5 text-gray-600" />
                    <div className="text-left">
                      <p className="font-medium text-gray-900 text-sm">FAQ</p>
                      <p className="text-xs text-gray-500">Frequently asked questions</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </Card>

            <div className="text-center py-3">
              <p className="text-sm font-semibold text-gray-700">Careable 360+</p>
              <p className="text-xs text-gray-500">Enabling Digital Healthcare for All</p>
              <p className="text-xs text-gray-400 mt-1">Version 2.0.0</p>
              <p className="text-[11px] text-gray-400 mt-1">© 2025 Careable 360+. All rights reserved.</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Install Prompt */}
      {showInstallPrompt && (
        <div className="fixed inset-0 z-50">
          <InstallPWA />
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setShowInstallPrompt(false)}
          />
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
