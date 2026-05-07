import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { Pill, CheckCircle, Clock, AlertCircle, Plus, Calendar, Activity, ShoppingBag, ShoppingCart, Stethoscope, FlaskConical, User, Heart, Sparkles, Tag, ExternalLink, Package, MoreVertical, Check, X as XIcon, RotateCcw, Phone, SkipForward, ChevronRight } from 'lucide-react';
import BottomNav from '../components/BottomNav';
import InstallPWA from '../components/InstallPWA';
import NotificationReliabilityHelper from '../components/NotificationReliabilityHelper';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';
import { toast } from '../hooks/use-toast';
import permissionManager from '../services/permissionManager';
import { Capacitor } from '@capacitor/core';

const HomePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedDate] = useState(new Date());
  const [medications, setMedications] = useState([]);
  const [bloodGlucose, setBloodGlucose] = useState([]);
  const [adherenceLogs, setAdherenceLogs] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [purchaseLinks, setPurchaseLinks] = useState(null);
  const [hasOrders, setHasOrders] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeStatusMenu, setActiveStatusMenu] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(null);
  const [showReliabilityHelper, setShowReliabilityHelper] = useState(false);
  const [showProfileBanner, setShowProfileBanner] = useState(false);
  const [isCaregiverLinked, setIsCaregiverLinked] = useState(false);
  const todayDate = selectedDate.toISOString().split('T')[0];
  
  // Get user name from authenticated user or fallback
  const userName = user?.name?.split(' ')[0] || 'User';

  // Helper function to format date for display
  const formatDate = (dateStr) => {
    try {
      const [year, month, day] = dateStr.split('-');
      const date = new Date(year, month - 1, day);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  };

  // Helper function to check if scheduled time has passed
  const isMissedDose = (scheduledTime) => {
    try {
      const now = new Date();
      const currentTime = now.getHours() * 60 + now.getMinutes(); // Current time in minutes
      
      const [hours, minutes] = scheduledTime.split(':').map(Number);
      const scheduledMinutes = hours * 60 + minutes; // Scheduled time in minutes
      
      return currentTime > scheduledMinutes;
    } catch (e) {
      return false;
    }
  };

  useEffect(() => {
    fetchData();
    checkReliabilityHelper();
    checkProfileCompletion();
  }, []);

  // Check if profile needs completion prompt
  const checkProfileCompletion = () => {
    const isComplete = user?.sex && user?.age && user?.address && user?.state && user?.pincode;
    if (!isComplete) {
      const dismissed = sessionStorage.getItem('profileBannerDismissed');
      if (!dismissed) {
        setShowProfileBanner(true);
      }
    }
  };

  // Check if reliability helper should be shown (once per install)
  const checkReliabilityHelper = async () => {
    if (Capacitor.isNativePlatform()) {
      const shouldShow = await permissionManager.shouldShowReliabilityHelper();
      if (shouldShow) {
        // Delay showing by 2 seconds to let the page load first
        setTimeout(() => setShowReliabilityHelper(true), 2000);
      }
    }
  };

  // Refetch when page becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchData();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', fetchData);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', fetchData);
    };
  }, []);


  const fetchData = async () => {
    try {
      setLoading(true);
      const [medsData, glucoseData, adherenceData, appointmentsData, linksData] = await Promise.all([
        apiService.getMedications().catch(() => []),
        apiService.getBloodGlucose().catch(() => null),
        apiService.getAdherence().catch(() => []),
        apiService.getAppointments().catch(() => []),
        apiService.getMyPurchaseLinks().catch(() => null)
      ]);
      setMedications(medsData || []);
      setBloodGlucose(glucoseData);
      setAdherenceLogs(adherenceData || []);
      setAppointments(appointmentsData || []);
      setPurchaseLinks(linksData);

      // Check if user has any orders
      try {
        const ordersData = await apiService.get('/api/orders');
        setHasOrders(Array.isArray(ordersData) && ordersData.length > 0);
      } catch { setHasOrders(false); }

      // Check if user is a caregiver for someone
      try {
        const cgData = await apiService.get('/api/caregiver/my-patient');
        setIsCaregiverLinked(cgData.linked === true);
      } catch { /* ignore */ }
    } catch (error) {
      console.error('Failed to fetch home data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCompletePurchaseClick = () => {
    const url = purchaseLinks?.product_invoice_link;
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
    // Ask the user shortly after whether they completed the purchase
    // so we can hide the card going forward.
    setTimeout(async () => {
      const confirmed = window.confirm(
        'Did you complete your purchase?\n\nTap OK to mark it as complete and hide this card. Tap Cancel if you haven\'t finished yet.'
      );
      if (!confirmed) return;
      try {
        await apiService.markProductOrderCompleted();
        setPurchaseLinks(prev => (prev ? { ...prev, product_order_completed: true } : prev));
        toast({
          title: 'Thanks!',
          description: 'Your purchase has been marked as completed.',
        });
      } catch (e) {
        console.error('Failed to mark product order completed:', e);
        toast({
          title: 'Could not update',
          description: 'Please try again in a moment.',
          variant: 'destructive',
        });
      }
    }, 400);
  };
  
  const todaySchedule = useMemo(() => {
    console.log('[HomePage] Computing todaySchedule...', {
      todayDate,
      medicationsCount: medications.length,
      adherenceLogsCount: adherenceLogs.length
    });
    
    const schedule = [];
    medications.forEach(med => {
      try {
        if (med.schedule && med.schedule.frequency === 'daily') {
          // Support both new dosage_timings and legacy times
          const dosageTimings = med.schedule.dosage_timings || [];
          const legacyTimes = med.schedule.times || [];
          
          // Use dosage_timings if available, otherwise fall back to legacy times
          const timings = dosageTimings.length > 0 
            ? dosageTimings 
            : legacyTimes.map(t => ({ time: t, amount: null }));
          
          timings.forEach(timing => {
            // Skip entries without a valid time
            if (!timing || !timing.time) {
              console.warn('[HomePage] Skipping timing with no time for:', med.name, timing);
              return;
            }
            
            // Check if this medication at this time was taken today
            const log = adherenceLogs.find(
              l => l.medication_id === med.id && 
                   l.scheduled_time === timing.time && 
                   l.date === todayDate
            );
            
            schedule.push({
              ...med,
              scheduledTime: timing.time,
              dosageAmount: timing.amount,
              status: log ? log.status : 'pending',
              takenTime: log ? log.taken_time : null
            });
          });
        }
      } catch (err) {
        console.error('[HomePage] Error processing medication:', med.name, err);
      }
    });
    return schedule.sort((a, b) => {
      const timeA = a.scheduledTime || '99:99';
      const timeB = b.scheduledTime || '99:99';
      return timeA.localeCompare(timeB);
    });
  }, [medications, adherenceLogs, todayDate]);

  const upcomingAppointments = appointments.filter(apt => apt.status === 'upcoming').slice(0, 2);
  const todayFood = [];
  const todayExercise = [];
  const latestGlucose = bloodGlucose.length > 0 ? bloodGlucose[0] : null;

  const completedToday = todaySchedule.filter(s => s.status === 'taken' || s.status === 'skipped').length;
  const skippedToday = todaySchedule.filter(s => s.status === 'skipped').length;
  const totalToday = todaySchedule.length;

  const handleMarkAsTaken = async (medication) => {
    try {
      console.log('[handleMarkAsTaken] Marking medication:', {
        name: medication.name,
        id: medication.id,
        scheduledTime: medication.scheduledTime,
        date: todayDate,
        dosageAmount: medication.dosageAmount
      });
      
      // Find existing adherence log for today
      const existingLog = adherenceLogs.find(
        l => l.medication_id === medication.id && 
             l.scheduled_time === medication.scheduledTime && 
             l.date === todayDate
      );
      
      const takenTime = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
      
      let result;
      if (existingLog) {
        console.log('[handleMarkAsTaken] Updating existing log:', existingLog.id);
        // Update existing log
        result = await apiService.request(`/api/adherence/${existingLog.id}?status=taken&taken_time=${takenTime}`, {
          method: 'PUT'
        });
        console.log('[handleMarkAsTaken] Update successful:', result);
      } else {
        console.log('[handleMarkAsTaken] Creating new adherence log');
        // Create new log (fallback)
        result = await apiService.recordAdherence({
          medication_id: medication.id,
          scheduled_time: medication.scheduledTime,
          taken_time: takenTime,
          date: todayDate,
          status: 'taken',
          dosage_amount: medication.dosageAmount || null
        });
        console.log('[handleMarkAsTaken] Create successful:', result);
      }

      // Refresh data immediately to update UI
      console.log('[handleMarkAsTaken] Fetching updated data...');
      await fetchData();
      console.log('[handleMarkAsTaken] Data refreshed. Adherence logs count:', adherenceLogs.length);

      toast({
        title: 'Success!',
        description: `Marked ${medication.name} as taken`,
      });
    } catch (error) {
      console.error('[handleMarkAsTaken] Error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to record. Please try again.',
        variant: 'destructive'
      });
    }
  };

  const handleSkipDose = async (medication) => {
    try {
      const existingLog = adherenceLogs.find(
        l => l.medication_id === medication.id && 
             l.scheduled_time === medication.scheduledTime && 
             l.date === todayDate
      );

      const now = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });

      if (existingLog) {
        await apiService.request(`/api/adherence/${existingLog.id}?status=skipped&taken_time=${now}`, {
          method: 'PUT'
        });
      } else {
        await apiService.recordAdherence({
          medication_id: medication.id,
          scheduled_time: medication.scheduledTime,
          taken_time: now,
          date: todayDate,
          status: 'skipped',
          dosage_amount: medication.dosageAmount || null
        });
      }

      await fetchData();
      toast({
        title: 'Dose skipped',
        description: `${medication.name} at ${medication.scheduledTime} marked as skipped`,
      });
    } catch (error) {
      console.error('[handleSkipDose] Error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to skip dose. Please try again.',
        variant: 'destructive'
      });
    }
  };

  // Handle appointment status update
  const handleUpdateAppointmentStatus = async (appointmentId, newStatus) => {
    setUpdatingStatus(appointmentId);
    try {
      await apiService.updateAppointmentStatus(appointmentId, newStatus);
      
      // Refresh appointments
      const appointmentsData = await apiService.getAppointments().catch(() => []);
      setAppointments(appointmentsData);
      
      setActiveStatusMenu(null);
      
      const statusMessages = {
        done: 'Appointment marked as completed',
        postponed: 'Appointment marked as postponed',
        abandoned: 'Appointment marked as abandoned'
      };
      
      toast({
        title: 'Success',
        description: statusMessages[newStatus] || 'Status updated',
      });
    } catch (error) {
      console.error('Error updating appointment status:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update status',
        variant: 'destructive'
      });
    } finally {
      setUpdatingStatus(null);
    }
  };

  const quickActions = [
    { id: 'appointment', icon: Stethoscope, label: 'Consult Doctor', color: 'bg-blue-500', action: 'dialog' },
    { id: 'lab', icon: FlaskConical, label: 'Book Lab Test', color: 'bg-purple-500', action: 'dialog' },
    { id: 'devices', icon: Heart, label: 'Buy Devices', color: 'bg-orange-500', route: '/medical-equipment', external: false },
    { id: 'personal-care', icon: Sparkles, label: 'Personal Care', color: 'bg-green-500', route: '/personal-care', external: false }
  ];

  const [bookingDialog, setBookingDialog] = useState(null); // 'appointment' | 'lab' | null

  const SUPPORT_PHONE = '+919422799196';
  const WHATSAPP_NUMBER = '917907970250';

  const getWhatsAppMessage = (type) => {
    const name = user?.name || '';
    const phone = user?.phone || '';
    const userInfo = name ? `\nName: ${name}` : '';
    const phoneInfo = phone ? `\nMobile: ${phone}` : '';

    if (type === 'appointment') {
      return `Hello, I am contacting through the Careable 360+ app. I would like to book a doctor consultation. Please assist me.${userInfo}${phoneInfo}`;
    }
    return `Hello, I am contacting through the Careable 360+ app. I would like to book a lab test. Please assist me.${userInfo}${phoneInfo}`;
  };

  // Calculate savings for Buy Medicine CTA
  const medicationSavings = useMemo(() => {
    const SHIPPING_COST = 100;
    const DAYS_IN_MONTH = 30;
    
    let totalMonthlyCost = SHIPPING_COST;
    let hasPurchaseData = false;
    
    medications.forEach(med => {
      // Skip medicines not included in invoice calculation
      if (med.include_in_invoice === false) return;
      
      let dailyConsumption = 0;
      
      if (med.schedule?.frequency === 'daily' && med.schedule?.dosage_timings?.length > 0) {
        med.schedule.dosage_timings.forEach(timing => {
          const amount = parseFloat(timing.amount) || 0;
          if (med.form === 'Tablet' || med.form === 'Capsule') {
            dailyConsumption += amount;
          } else if (med.form === 'Injection') {
            dailyConsumption += amount;
          }
        });
      } else if (med.schedule?.frequency === 'weekly' && med.schedule?.dosage_timings?.length > 0) {
        let weeklyTotal = 0;
        med.schedule.dosage_timings.forEach(timing => {
          weeklyTotal += parseFloat(timing.amount) || 0;
        });
        dailyConsumption = weeklyTotal / 7;
      }
      
      const monthlyNeed = dailyConsumption * DAYS_IN_MONTH;
      
      if (med.cost_per_unit && monthlyNeed > 0) {
        hasPurchaseData = true;
        if (med.form === 'Tablet' || med.form === 'Capsule') {
          // cost_per_unit is the cost of a strip, not a single tablet
          // Divide by tablets_per_strip to get cost per tablet
          const tabletsPerStrip = med.tablets_per_strip || 1;
          const costPerTablet = med.cost_per_unit / tabletsPerStrip;
          totalMonthlyCost += monthlyNeed * costPerTablet;
        } else if (med.form === 'Injection' && med.injection_iu_per_package) {
          const vialsNeeded = Math.ceil(monthlyNeed / med.injection_iu_per_package);
          totalMonthlyCost += vialsNeeded * med.cost_per_unit;
        }
      }
    });
    
    // Use user-level purchase links instead of medication-level
    const totalInvoiceAmount = (purchaseLinks?.medicine_invoice_amount || 0) + (purchaseLinks?.injection_invoice_amount || 0);
    if (totalInvoiceAmount > 0) {
      hasPurchaseData = true;
    }
    
    const savings = totalMonthlyCost - totalInvoiceAmount;
    
    return {
      savings: Math.round(savings * 100) / 100,
      hasSavings: savings > 0 && totalInvoiceAmount > 0,
      hasPurchaseData
    };
  }, [medications, purchaseLinks]);

  return (
    <div className="pb-20 bg-gray-50 min-h-screen">
      {/* Notification Reliability Helper - shown once on native */}
      {showReliabilityHelper && (
        <NotificationReliabilityHelper
          onComplete={() => setShowReliabilityHelper(false)}
          onSkip={() => setShowReliabilityHelper(false)}
        />
      )}
      
      {/* Header */}
      <div className="bg-gradient-to-r from-[#1E3A5F] via-[#2BA89F] to-[#7AB648] p-6 rounded-b-3xl shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Hi {userName}!</h1>
            <p className="text-emerald-100 text-sm">{selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              onClick={() => navigate('/profile')}
              size="sm"
              className="bg-white/20 hover:bg-white/30 text-white border-white/30 backdrop-blur-sm h-10 w-10 p-0 rounded-full"
            >
              <User className="w-5 h-5" />
            </Button>
            {/* Exit App Button - Native only */}
            {Capacitor.isNativePlatform() && (
              <Button 
                onClick={async () => {
                  try {
                    const { App } = await import('@capacitor/app');
                    App.exitApp();
                  } catch (e) {
                    console.log('Exit app failed:', e);
                  }
                }}
                size="sm"
                className="bg-white/20 hover:bg-red-500/50 text-white border-white/30 backdrop-blur-sm h-10 w-10 p-0 rounded-full"
                title="Exit App"
                data-testid="exit-app-btn"
              >
                <XIcon className="w-5 h-5" />
              </Button>
            )}
          </div>
        </div>

        {/* Latest Blood Glucose */}
        {latestGlucose && (
          <Card className="p-4 bg-white/10 backdrop-blur-md border-white/20 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Activity className="w-8 h-8 text-white" />
                <div>
                  <p className="text-white/80 text-xs">Blood Glucose</p>
                  <p className="text-2xl font-bold text-white">{latestGlucose.value} <span className="text-sm">mg/dL</span></p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-white/80 text-xs">{latestGlucose.meal_context}</p>
                <p className="text-white/80 text-xs">{formatDate(latestGlucose.date)} {latestGlucose.time}</p>
              </div>
            </div>
          </Card>
        )}

        {/* Medication Progress */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20">
          <div className="flex items-center justify-between mb-3">
            <span className="text-white font-medium">Medication Progress</span>
            <span className="text-white font-bold text-lg">
              {completedToday}/{totalToday}
              {skippedToday > 0 && <span className="text-white/70 text-sm font-normal ml-1">({skippedToday} skipped)</span>}
            </span>
          </div>
          <Progress value={totalToday > 0 ? (completedToday / totalToday) * 100 : 0} className="h-3 bg-white/20" />
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Profile Completion Banner */}
        {showProfileBanner && (
          <Card className="p-3 bg-amber-50 border-amber-200" data-testid="profile-banner">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <User className="w-4 h-4 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-amber-900">Complete your profile</p>
                <p className="text-xs text-amber-700 mt-0.5">Add your details for a personalized experience</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 text-xs h-7 border-amber-300 text-amber-700 hover:bg-amber-100"
                  onClick={() => navigate('/profile-setup')}
                  data-testid="profile-banner-btn"
                >
                  Complete Profile
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="p-1 h-6 w-6 text-amber-400 hover:text-amber-600 hover:bg-amber-100"
                onClick={() => {
                  setShowProfileBanner(false);
                  sessionStorage.setItem('profileBannerDismissed', 'true');
                }}
                data-testid="profile-banner-dismiss"
              >
                <XIcon className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        )}

        {/* Caregiver Dashboard Banner */}
        {isCaregiverLinked && (
          <Card
            className="p-3 bg-blue-50 border-blue-200 cursor-pointer hover:bg-blue-100 transition-colors"
            onClick={() => navigate('/caregiver-dashboard')}
            data-testid="caregiver-dashboard-banner"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Heart className="w-4 h-4 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-900">Caregiver Dashboard</p>
                <p className="text-xs text-blue-700">View your patient's medication status</p>
              </div>
              <Activity className="w-4 h-4 text-blue-400" />
            </div>
          </Card>
        )}

        {/* Quick Actions */}
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-3 px-1">Quick Actions</h2>
          <div className="grid grid-cols-4 gap-3">
            {quickActions.map(action => {
              const Icon = action.icon;
              return (
                <button
                  key={action.id}
                  onClick={() => {
                    if (action.action === 'dialog') {
                      setBookingDialog(action.id);
                    } else if (action.route?.startsWith('tel:')) {
                      window.location.href = action.route;
                    } else if (action.external) {
                      window.open(action.route, '_blank', 'noopener,noreferrer');
                    } else {
                      navigate(action.route, { state: action.state });
                    }
                  }}
                  className="flex flex-col items-center gap-2 p-3 bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow"
                  data-testid={`quick-action-${action.id}`}
                >
                  <div className={`w-12 h-12 ${action.color} rounded-xl flex items-center justify-center`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-xs font-medium text-gray-700 text-center">{action.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Buy Medicine CTA Section - Only show when Prescription Manager has set an invoice link */}
        {(purchaseLinks?.medicine_invoice_link || purchaseLinks?.injection_invoice_link) && (
        <div className="relative overflow-hidden">
          <style>
            {`
              @keyframes shimmer {
                0% { background-position: -200% center; }
                100% { background-position: 200% center; }
              }
              .savings-badge {
                background: linear-gradient(90deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0.1) 100%);
                background-size: 200% auto;
                animation: shimmer 2s linear infinite;
              }
              @keyframes pulse-glow {
                0%, 100% { box-shadow: 0 0 5px rgba(255,255,0,0.5), 0 0 10px rgba(255,255,0,0.3); }
                50% { box-shadow: 0 0 15px rgba(255,255,0,0.8), 0 0 25px rgba(255,255,0,0.5); }
              }
              .glow-effect {
                animation: pulse-glow 1.5s ease-in-out infinite;
              }
            `}
          </style>
          <Card className="bg-gradient-to-r from-rose-500 via-pink-500 to-orange-400 p-5 shadow-lg border-0">
            <div className="relative z-10">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-3">
                    <ShoppingBag className="w-6 h-6 text-white" />
                    <h3 className="text-lg font-bold text-white">Buy Medicine</h3>
                  </div>
                  {medicationSavings.hasSavings && (
                    <div className="savings-badge glow-effect inline-flex items-center gap-1.5 bg-yellow-400/30 backdrop-blur-sm rounded-full px-4 py-2 mb-4 border border-yellow-300/50">
                      <Tag className="w-5 h-5 text-yellow-200" />
                      <span className="text-white font-bold text-base">
                        Save ₹{medicationSavings.savings.toLocaleString('en-IN')} every month!!!
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <Button 
                onClick={() => navigate('/medications')}
                className="w-full bg-white text-pink-600 hover:bg-white/90 font-semibold py-5 text-base shadow-md"
                data-testid="buy-medicine-cta-btn"
              >
                <ShoppingCart className="w-5 h-5 mr-2" />
                Shop Now
                <ExternalLink className="w-4 h-4 ml-2" />
              </Button>
            </div>
            {/* Decorative elements */}
            <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full"></div>
            <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full"></div>
          </Card>
        </div>
        )}

        {/* Complete Your Purchase Now - independent card shown only when
            PM has set a Product Invoice Link AND customer hasn't marked it completed */}
        {purchaseLinks?.product_invoice_link && !purchaseLinks?.product_order_completed && (
          <Card
            className="relative overflow-hidden p-5 border-0 shadow-md cursor-pointer hover:shadow-xl transition-shadow bg-gradient-to-br from-[#2BA89F] via-[#1E8A82] to-[#1E3A5F]"
            onClick={handleCompletePurchaseClick}
            data-testid="complete-purchase-card"
          >
            <div className="relative z-10 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-11 h-11 bg-white/25 backdrop-blur-sm rounded-xl flex items-center justify-center shrink-0">
                  <ShoppingBag className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-white text-base leading-tight">Complete Your Purchase Now</h3>
                  <p className="text-xs text-white/85 mt-0.5 truncate">
                    Tap to open your product invoice and complete purchase
                  </p>
                </div>
              </div>
              <ExternalLink className="w-5 h-5 text-white/90 shrink-0" />
            </div>
            <div className="absolute -right-10 -top-10 w-32 h-32 bg-white/10 rounded-full" />
            <div className="absolute -right-6 -bottom-6 w-20 h-20 bg-white/10 rounded-full" />
          </Card>
        )}

        {/* Upcoming Appointments */}
        {upcomingAppointments.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3 px-1">
              <h2 className="text-lg font-bold text-gray-900">Upcoming</h2>
              <Button size="sm" variant="ghost" onClick={() => navigate('/booking')}>View All</Button>
            </div>
            <div className="space-y-2">
              {upcomingAppointments.map(apt => (
                <Card key={apt.id} className="p-4 shadow-sm relative">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      apt.type === 'doctor' ? 'bg-blue-100' : 'bg-purple-100'
                    }`}>
                      {apt.type === 'doctor' ? (
                        <Stethoscope className="w-6 h-6 text-blue-600" />
                      ) : (
                        <FlaskConical className="w-6 h-6 text-purple-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{apt.title}</h3>
                      <p className="text-sm text-gray-600">{apt.doctor || apt.location}</p>
                      <p className="text-xs text-gray-500 mt-1">{new Date(apt.date).toLocaleDateString()} at {apt.time}</p>
                    </div>
                    
                    {/* Status Update Menu */}
                    <div className="relative">
                      <button
                        onClick={() => setActiveStatusMenu(activeStatusMenu === apt.id ? null : apt.id)}
                        className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg transition flex items-center gap-1 text-gray-600 border border-gray-200"
                        data-testid={`appointment-menu-${apt.id}`}
                      >
                        <span className="text-xs font-medium">Update</span>
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      
                      {activeStatusMenu === apt.id && (
                        <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border z-10 py-1 min-w-[160px]">
                          <button
                            onClick={() => handleUpdateAppointmentStatus(apt.id, 'done')}
                            disabled={updatingStatus === apt.id}
                            className="w-full px-4 py-2 text-left hover:bg-green-50 flex items-center gap-2 text-green-700"
                          >
                            <Check className="w-4 h-4" />
                            <span>Mark as Done</span>
                          </button>
                          <button
                            onClick={() => handleUpdateAppointmentStatus(apt.id, 'postponed')}
                            disabled={updatingStatus === apt.id}
                            className="w-full px-4 py-2 text-left hover:bg-orange-50 flex items-center gap-2 text-orange-700"
                          >
                            <RotateCcw className="w-4 h-4" />
                            <span>Postponed</span>
                          </button>
                          <button
                            onClick={() => handleUpdateAppointmentStatus(apt.id, 'abandoned')}
                            disabled={updatingStatus === apt.id}
                            className="w-full px-4 py-2 text-left hover:bg-red-50 flex items-center gap-2 text-red-700"
                          >
                            <XIcon className="w-4 h-4" />
                            <span>Abandoned</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Today's Medications */}
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-3 px-1">Medications</h2>
          <div className="space-y-3">
            {loading ? (
              <Card className="p-8 text-center">
                <Clock className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500">Loading medications...</p>
              </Card>
            ) : todaySchedule.length === 0 ? (
              <Card className="p-8 text-center">
                <Clock className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500">No medications scheduled</p>
                <Button onClick={() => navigate('/medications/add')} className="mt-4 bg-blue-600 hover:bg-blue-700">
                  <Plus className="w-5 h-5 mr-2" />
                  Add Medication
                </Button>
              </Card>
            ) : (
              todaySchedule.map((item, index) => {
                const isMissed = item.status === 'pending' && isMissedDose(item.scheduledTime);
                return (
                <Card 
                  key={index} 
                  className={`p-4 shadow-sm transition-all duration-200 ${
                    item.status === 'taken' 
                      ? 'bg-green-50 border-green-200' 
                      : item.status === 'skipped'
                      ? 'bg-amber-50 border-amber-200'
                      : isMissed
                      ? 'bg-red-50 border-red-200'
                      : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: (item.color || '#FF6B6B') + '30' }}>
                      <Pill className="w-7 h-7" style={{ color: item.color || '#FF6B6B' }} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{item.name}</h3>
                      <p className="text-sm text-gray-600">
                        {item.dosageAmount && (
                          <span className="font-medium text-blue-600">
                            {item.dosageAmount} {item.form === 'Injection' ? 'IU' : item.form === 'Tablet' || item.form === 'Capsule' ? 'pill(s)' : ''}
                          </span>
                        )}
                        {item.dosageAmount && ' • '}
                        {item.scheduledTime}
                      </p>
                      {item.instructions && (
                        <p className="text-xs text-gray-500 mt-1">{item.instructions}</p>
                      )}
                      {/* Stock info */}
                      {(item.form === 'Tablet' || item.form === 'Capsule') && item.tablet_stock_count !== undefined && (
                        <p className={`text-xs mt-1 font-medium ${
                          item.tablet_stock_count < 10
                            ? 'text-red-600'
                            : item.tablet_stock_count < 20
                            ? 'text-orange-600'
                            : 'text-green-600'
                        }`}>
                          Stock: {item.tablet_stock_count} remaining
                        </p>
                      )}
                      {item.form === 'Injection' && item.injection_stock_count !== undefined && (
                        <p className={`text-xs mt-1 font-medium ${
                          item.injection_stock_count < 2
                            ? 'text-red-600'
                            : item.injection_stock_count < 3
                            ? 'text-orange-600'
                            : 'text-green-600'
                        }`}>
                          Stock: {item.injection_stock_count} vial{item.injection_stock_count !== 1 ? 's' : ''} remaining
                        </p>
                      )}
                    </div>
                    {item.status === 'taken' ? (
                      <CheckCircle className="w-8 h-8 text-green-500 flex-shrink-0" />
                    ) : item.status === 'skipped' ? (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <SkipForward className="w-5 h-5 text-amber-500" />
                        <span className="text-xs font-medium text-amber-600">Skipped</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Button
                          data-testid={`skip-dose-${item.id}-${item.scheduledTime}`}
                          onClick={() => handleSkipDose(item)}
                          size="sm"
                          variant="outline"
                          className="border-amber-300 text-amber-600 hover:bg-amber-50 hover:text-amber-700"
                        >
                          <SkipForward className="w-4 h-4 mr-1" />
                          Skip
                        </Button>
                        <Button 
                          data-testid={`take-dose-${item.id}-${item.scheduledTime}`}
                          onClick={() => handleMarkAsTaken(item)}
                          size="sm"
                          className={`${
                            isMissed
                              ? 'bg-red-600 hover:bg-red-700'
                              : 'bg-emerald-600 hover:bg-emerald-700'
                          } text-white`}
                        >
                          Take
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              )})
            )}
          </div>
        </div>
      </div>

      <InstallPWA />
      {/* Booking Dialog */}
      {bookingDialog && (
        <div className="fixed inset-0 bg-black/50 z-[10000] flex items-center justify-center p-4" onClick={() => setBookingDialog(null)}>
          <div
            className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl"
            onClick={e => e.stopPropagation()}
            data-testid="booking-dialog"
          >
            <h2 className="text-xl font-bold text-center text-gray-900 mb-2">
              {bookingDialog === 'appointment' ? 'Book a Doctor Consultation' : 'Book a Lab Test'}
            </h2>
            <p className="text-center text-gray-500 text-sm mb-6">
              {bookingDialog === 'appointment'
                ? 'How would you like to book your consultation?'
                : 'How would you like to book your lab test?'}
            </p>

            <div className="space-y-3">
              {/* Call Button */}
              <button
                onClick={() => {
                  setBookingDialog(null);
                  window.location.href = `tel:${SUPPORT_PHONE}`;
                }}
                className="w-full flex items-center gap-4 p-4 bg-blue-50 hover:bg-blue-100 border-2 border-blue-200 rounded-xl transition-colors"
                data-testid="booking-call-btn"
              >
                <div className="w-14 h-14 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <Phone className="w-7 h-7 text-white" />
                </div>
                <div className="text-left">
                  <p className="text-lg font-bold text-blue-900">Call Support</p>
                  <p className="text-sm text-blue-600">Speak with our team directly</p>
                </div>
              </button>

              {/* WhatsApp Button */}
              <button
                onClick={() => {
                  setBookingDialog(null);
                  const msg = encodeURIComponent(getWhatsAppMessage(bookingDialog));
                  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`, '_blank');
                }}
                className="w-full flex items-center gap-4 p-4 bg-green-50 hover:bg-green-100 border-2 border-green-200 rounded-xl transition-colors"
                data-testid="booking-whatsapp-btn"
              >
                <div className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                </div>
                <div className="text-left">
                  <p className="text-lg font-bold text-green-900">WhatsApp</p>
                  <p className="text-sm text-green-600">Message us on WhatsApp</p>
                </div>
              </button>
            </div>

            {/* Close */}
            <button
              onClick={() => setBookingDialog(null)}
              className="w-full mt-4 py-3 text-gray-500 text-sm font-medium hover:text-gray-700"
              data-testid="booking-dialog-close"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <BottomNav active="home" />
    </div>
  );
};

export default HomePage;
