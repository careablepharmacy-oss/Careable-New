import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { Pill, Activity, Heart, Weight, TrendingUp, TrendingDown, Minus, ChevronRight } from 'lucide-react';
import BottomNav from '../components/BottomNav';
import LogHealthMetricModal from '../components/LogHealthMetricModal';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/api';

const ReportsPage = () => {
  const navigate = useNavigate();
  const [bloodGlucose, setBloodGlucose] = useState([]);
  const [bloodPressure, setBloodPressure] = useState([]);
  const [bodyMetrics, setBodyMetrics] = useState([]);
  const [adherenceLogs, setAdherenceLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Helper function to format last updated timestamp
  const formatLastUpdated = (dateTimeStr) => {
    try {
      // dateTimeStr format is like "2025-01-25 14:30"
      const [datePart, timePart] = dateTimeStr.split(' ');
      if (!datePart) return dateTimeStr;
      
      const [year, month, day] = datePart.split('-');
      const date = new Date(year, month - 1, day);
      
      const monthStr = date.toLocaleString('en-US', { month: 'short' });
      const dayStr = date.getDate();
      
      if (timePart) {
        return `${monthStr} ${dayStr}, ${timePart}`;
      }
      return `${monthStr} ${dayStr}`;
    } catch (e) {
      return dateTimeStr;
    }
  };

  useEffect(() => {
    fetchHealthData();
  }, []);

  // Refetch when page becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchHealthData();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', fetchHealthData);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', fetchHealthData);
    };
  }, []);

  const fetchHealthData = async () => {
    try {
      setLoading(true);
      const [glucoseData, bpData, metricsData, adherenceData] = await Promise.all([
        apiService.getBloodGlucose(),
        apiService.getBloodPressure(),
        apiService.getBodyMetrics(),
        apiService.getAdherence().catch(() => [])
      ]);
      setBloodGlucose(glucoseData);
      setBloodPressure(bpData);
      setBodyMetrics(metricsData);
      setAdherenceLogs(adherenceData);
    } catch (error) {
      console.error('Failed to fetch health data:', error);
    } finally {
      setLoading(false);
    }
  };

  const adherenceStats = useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return date.toISOString().split('T')[0];
    });

    const stats = last7Days.map(date => {
      const dayLogs = adherenceLogs.filter(l => l.date === date && l.status !== 'pending');
      const taken = dayLogs.filter(l => l.status === 'taken').length;
      const total = dayLogs.length;
      return {
        date,
        day: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
        rate: total > 0 ? Math.round((taken / total) * 100) : 0,
        taken,
        total
      };
    }).reverse();

    const allLogs = adherenceLogs.filter(l => l.status !== 'pending');
    const allTaken = allLogs.filter(l => l.status === 'taken').length;
    const overallRate = allLogs.length > 0 ? Math.round((allTaken / allLogs.length) * 100) : 0;

    return { daily: stats, overall: overallRate, totalTaken: allTaken, totalScheduled: allLogs.length };
  }, [adherenceLogs]);

  const latestGlucose = bloodGlucose.length > 0 ? bloodGlucose[0] : null;
  const avgGlucose = bloodGlucose.length > 0 ? Math.round(bloodGlucose.reduce((acc, bg) => acc + bg.value, 0) / bloodGlucose.length) : 0;
  
  const latestBP = bloodPressure.length > 0 ? bloodPressure[0] : null;
  const avgBP = bloodPressure.length > 0 ? {
    systolic: Math.round(bloodPressure.reduce((acc, bp) => acc + bp.systolic, 0) / bloodPressure.length),
    diastolic: Math.round(bloodPressure.reduce((acc, bp) => acc + bp.diastolic, 0) / bloodPressure.length)
  } : { systolic: 0, diastolic: 0 };

  const latestMetrics = bodyMetrics.length > 0 ? bodyMetrics[0] : null;
  const previousMetrics = bodyMetrics.length > 1 ? bodyMetrics[1] : null;
  const weightChange = (latestMetrics && previousMetrics) ? (latestMetrics.weight - previousMetrics.weight) : 0;

  const handleSaveMetric = (type, data) => {
    console.log(`Saving ${type} metric:`, data);
    // This will be replaced with actual API call
  };

  const healthMetrics = [
    {
      id: 'glucose',
      title: 'Blood Glucose',
      icon: Activity,
      value: latestGlucose ? latestGlucose.value : '--',
      unit: 'mg/dL',
      average: avgGlucose,
      color: 'from-red-500 to-orange-500',
      bgColor: 'bg-red-50',
      iconColor: 'text-red-600',
      status: latestGlucose && latestGlucose.value <= 140 ? 'good' : 'warning',
      hasData: !!latestGlucose,
      lastUpdated: latestGlucose ? `${latestGlucose.date} ${latestGlucose.time}` : null
    },
    {
      id: 'bp',
      title: 'Blood Pressure',
      icon: Heart,
      value: latestBP ? `${latestBP.systolic}/${latestBP.diastolic}` : '--/--',
      unit: 'mmHg',
      average: `${avgBP.systolic}/${avgBP.diastolic}`,
      color: 'from-pink-500 to-rose-500',
      bgColor: 'bg-pink-50',
      iconColor: 'text-pink-600',
      status: latestBP && latestBP.systolic <= 130 && latestBP.diastolic <= 85 ? 'good' : 'warning',
      hasData: !!latestBP,
      lastUpdated: latestBP ? `${latestBP.date} ${latestBP.time}` : null
    },
    {
      id: 'weight',
      title: 'Weight & BMI',
      icon: Weight,
      value: latestMetrics ? latestMetrics.weight : '--',
      unit: 'kg',
      bmi: latestMetrics ? latestMetrics.bmi : '--',
      change: weightChange,
      color: 'from-purple-500 to-indigo-500',
      bgColor: 'bg-purple-50',
      iconColor: 'text-purple-600',
      status: latestMetrics && latestMetrics.bmi < 25 ? 'good' : latestMetrics && latestMetrics.bmi < 30 ? 'warning' : 'alert',
      hasData: !!latestMetrics,
      lastUpdated: latestMetrics ? latestMetrics.date : null
    }
  ];

  return (
    <div className="pb-20 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#1E3A5F] via-[#2BA89F] to-[#7AB648] p-6 rounded-b-3xl shadow-lg">
        <h1 className="text-2xl font-bold text-white mb-6">Health Reports</h1>
        
        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-3 bg-white/10 backdrop-blur-md border-white/20 text-center">
            <div className="text-2xl font-bold text-white mb-1">{adherenceStats.overall}%</div>
            <div className="text-xs text-emerald-100">Adherence</div>
          </Card>
          <Card className="p-3 bg-white/10 backdrop-blur-md border-white/20 text-center">
            <div className="text-2xl font-bold text-white mb-1">{avgGlucose}</div>
            <div className="text-xs text-emerald-100">Avg Glucose</div>
          </Card>
          <Card className="p-3 bg-white/10 backdrop-blur-md border-white/20 text-center">
            <div className="text-2xl font-bold text-white mb-1">{latestMetrics ? latestMetrics.bmi : '--'}</div>
            <div className="text-xs text-emerald-100">BMI</div>
          </Card>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Health Metrics Overview */}
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-3 px-1">Health Metrics</h2>
          <div className="space-y-3">
            {healthMetrics.map(metric => {
              const Icon = metric.icon;
              return (
                <Card 
                  key={metric.id}
                  className={`p-4 shadow-sm ${metric.bgColor}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-white`}>
                        <Icon className={`w-6 h-6 ${metric.iconColor}`} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{metric.title}</h3>
                        <p className="text-xs text-gray-500">
                          {metric.hasData && metric.lastUpdated 
                            ? `Last updated: ${formatLastUpdated(metric.lastUpdated)}` 
                            : 'No data logged yet'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <LogHealthMetricModal 
                        type={metric.id} 
                        onSave={async (data) => {
                          await handleSaveMetric(metric.id, data);
                          await fetchHealthData(); // Refresh data after saving
                        }}
                      />
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => navigate(`/reports/history/${metric.id}`)}
                        className="h-9 w-9 p-0"
                      >
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-3xl font-bold text-gray-900">
                        {metric.value} 
                        <span className="text-sm font-normal text-gray-600 ml-1">{metric.unit}</span>
                      </p>
                      {metric.bmi && (
                        <p className="text-sm text-gray-600 mt-1">BMI: {metric.bmi}</p>
                      )}
                      {metric.change !== undefined && (
                        <div className="flex items-center gap-1 mt-1">
                          {metric.change > 0 ? (
                            <TrendingUp className="w-4 h-4 text-orange-500" />
                          ) : metric.change < 0 ? (
                            <TrendingDown className="w-4 h-4 text-green-500" />
                          ) : (
                            <Minus className="w-4 h-4 text-gray-400" />
                          )}
                          <span className={`text-xs font-medium ${
                            metric.change > 0 ? 'text-orange-600' : metric.change < 0 ? 'text-green-600' : 'text-gray-500'
                          }`}>
                            {Math.abs(metric.change).toFixed(1)} kg
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500 mb-1">7-day avg</p>
                      <p className="text-lg font-semibold text-gray-700">{metric.average}</p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Medication Adherence */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <Pill className="w-5 h-5 text-emerald-600" />
            <h2 className="font-semibold text-gray-900">Medication Adherence</h2>
          </div>
          <div className="space-y-3">
            {adherenceStats.daily.map((day, index) => (
              <div key={index}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">{day.day}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{day.taken}/{day.total}</span>
                    <span className="text-sm font-semibold text-gray-900 min-w-[45px] text-right">{day.rate}%</span>
                  </div>
                </div>
                <Progress value={day.rate} className="h-2" />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <BottomNav active="reports" />
    </div>
  );
};

export default ReportsPage;
