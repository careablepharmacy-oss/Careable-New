import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { ArrowLeft, Activity, Heart, Weight } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import apiService from '../services/api';

const HealthHistoryPage = () => {
  const { type } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [bloodGlucose, setBloodGlucose] = useState([]);
  const [bloodPressure, setBloodPressure] = useState([]);
  const [bodyMetrics, setBodyMetrics] = useState([]);

  useEffect(() => {
    fetchData();
  }, [type]);

  const fetchData = async () => {
    try {
      setLoading(true);
      switch(type) {
        case 'glucose':
          const glucoseData = await apiService.getBloodGlucose();
          setBloodGlucose(glucoseData);
          break;
        case 'bp':
          const bpData = await apiService.getBloodPressure();
          setBloodPressure(bpData);
          break;
        case 'weight':
          const metricsData = await apiService.getBodyMetrics();
          setBodyMetrics(metricsData);
          break;
      }
    } catch (error) {
      console.error('Failed to fetch health data:', error);
    } finally {
      setLoading(false);
    }
  };

  const chartData = useMemo(() => {
    switch(type) {
      case 'glucose':
        if (bloodGlucose.length === 0) return null;
        return {
          title: 'Blood Glucose History',
          icon: Activity,
          color: '#ef4444',
          unit: 'mg/dL',
          data: bloodGlucose.map(bg => ({
            date: new Date(bg.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            value: bg.value,
            time: bg.time,
            context: bg.meal_context
          })),
          average: Math.round(bloodGlucose.reduce((acc, bg) => acc + bg.value, 0) / bloodGlucose.length),
          latest: bloodGlucose[bloodGlucose.length - 1].value,
          targetRange: '70-140 mg/dL'
        };
      case 'bp':
        if (bloodPressure.length === 0) return null;
        return {
          title: 'Blood Pressure History',
          icon: Heart,
          color: '#ec4899',
          unit: 'mmHg',
          data: bloodPressure.map(bp => ({
            date: new Date(bp.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            systolic: bp.systolic,
            diastolic: bp.diastolic,
            pulse: bp.pulse
          })),
          average: {
            systolic: Math.round(bloodPressure.reduce((acc, bp) => acc + bp.systolic, 0) / bloodPressure.length),
            diastolic: Math.round(bloodPressure.reduce((acc, bp) => acc + bp.diastolic, 0) / bloodPressure.length)
          },
          latest: bloodPressure[bloodPressure.length - 1],
          targetRange: '<130/85 mmHg'
        };
      case 'weight':
        if (bodyMetrics.length === 0) return null;
        return {
          title: 'Weight & BMI History',
          icon: Weight,
          color: '#8b5cf6',
          unit: 'kg',
          data: bodyMetrics.map(bm => ({
            date: new Date(bm.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            weight: bm.weight,
            bmi: bm.bmi
          })),
          average: Math.round((bodyMetrics.reduce((acc, bm) => acc + bm.weight, 0) / bodyMetrics.length) * 10) / 10,
          latest: bodyMetrics[bodyMetrics.length - 1],
          targetRange: 'BMI 18.5-24.9'
        };
      default:
        return null;
    }
  }, [type, bloodGlucose, bloodPressure, bodyMetrics]);

  if (loading) {
    return (
      <div className="pb-6 bg-gray-50 min-h-screen">
        <div className="bg-white border-b sticky top-0 z-10">
          <div className="p-4 flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/reports')} className="h-10 w-10 p-0">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-bold text-gray-900">Health History</h1>
          </div>
        </div>
        <div className="p-4 flex items-center justify-center h-64">
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!chartData) {
    return (
      <div className="pb-6 bg-gray-50 min-h-screen">
        <div className="bg-white border-b sticky top-0 z-10">
          <div className="p-4 flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/reports')} className="h-10 w-10 p-0">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-bold text-gray-900">Health History</h1>
          </div>
        </div>
        <div className="p-4">
          <Card className="p-8 text-center">
            <Activity className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No data available yet</p>
            <p className="text-sm text-gray-400 mt-2">Start logging your health metrics to see trends</p>
            <Button onClick={() => navigate('/reports')} className="mt-4 bg-emerald-600 hover:bg-emerald-700">
              Go to Reports
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  const Icon = chartData.icon;

  return (
    <div className="pb-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="p-4 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/reports')} className="h-10 w-10 p-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{chartData.title}</h1>
            <p className="text-sm text-gray-500">Historical trends & data</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Current Stats */}
        <Card className="p-6" style={{ background: `linear-gradient(135deg, ${chartData.color}15 0%, ${chartData.color}05 100%)` }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm">
                <Icon className="w-6 h-6" style={{ color: chartData.color }} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Latest Reading</p>
                <p className="text-3xl font-bold text-gray-900">
                  {type === 'bp' 
                    ? `${chartData.latest.systolic}/${chartData.latest.diastolic}`
                    : type === 'weight'
                    ? chartData.latest.weight
                    : chartData.latest}
                  <span className="text-sm font-normal text-gray-600 ml-2">{chartData.unit}</span>
                </p>
                {type === 'weight' && (
                  <p className="text-sm text-gray-600 mt-1">BMI: {chartData.latest.bmi}</p>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500 mb-1">Average</p>
              <p className="text-xl font-semibold text-gray-700">
                {type === 'bp'
                  ? `${chartData.average.systolic}/${chartData.average.diastolic}`
                  : chartData.average}
              </p>
              <p className="text-xs text-gray-500 mt-2">Target: {chartData.targetRange}</p>
            </div>
          </div>
        </Card>

        {/* Chart */}
        <Card className="p-4">
          <h3 className="font-semibold text-gray-900 mb-4">Trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              {type === 'bp' ? (
                <LineChart data={chartData.data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                  <Tooltip />
                  <Line type="monotone" dataKey="systolic" stroke="#ef4444" strokeWidth={2} dot={{ fill: '#ef4444', r: 4 }} />
                  <Line type="monotone" dataKey="diastolic" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 4 }} />
                </LineChart>
              ) : (
                <AreaChart data={chartData.data}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartData.color} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={chartData.color} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                  <Tooltip />
                  <Area 
                    type="monotone" 
                    dataKey={type === 'weight' ? 'weight' : 'value'} 
                    stroke={chartData.color} 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorValue)" 
                  />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Recent Readings */}
        <Card className="p-4">
          <h3 className="font-semibold text-gray-900 mb-4">Recent Readings</h3>
          <div className="space-y-3">
            {chartData.data.slice(-5).reverse().map((reading, index) => (
              <div key={index} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="font-medium text-gray-900">{reading.date}</p>
                  {reading.time && <p className="text-xs text-gray-500">{reading.time} {reading.context && `• ${reading.context}`}</p>}
                </div>
                <p className="font-semibold text-gray-900">
                  {type === 'bp'
                    ? `${reading.systolic}/${reading.diastolic}`
                    : type === 'weight'
                    ? `${reading.weight} kg • BMI ${reading.bmi}`
                    : `${reading.value} ${chartData.unit}`}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default HealthHistoryPage;
