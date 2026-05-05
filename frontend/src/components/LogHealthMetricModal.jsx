import React, { useState } from 'react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Activity, Heart, Weight, Plus, X } from 'lucide-react';
import { toast } from '../hooks/use-toast';
import apiService from '../services/api';

const LogHealthMetricModal = ({ type, onSave }) => {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    glucose: { value: '', time: new Date().toTimeString().slice(0, 5), mealContext: 'Fasting' },
    bp: { systolic: '', diastolic: '', pulse: '', time: new Date().toTimeString().slice(0, 5) },
    weight: { weight: '', height: '170', date: new Date().toISOString().split('T')[0] }
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    let data = {};
    let apiCall;
    
    if (type === 'glucose') {
      data = {
        value: parseInt(formData.glucose.value),
        time: formData.glucose.time,
        meal_context: formData.glucose.mealContext,
        date: new Date().toISOString().split('T')[0]
      };
      apiCall = apiService.createBloodGlucose(data);
    } else if (type === 'bp') {
      data = {
        systolic: parseInt(formData.bp.systolic),
        diastolic: parseInt(formData.bp.diastolic),
        pulse: parseInt(formData.bp.pulse) || null,
        time: formData.bp.time,
        date: new Date().toISOString().split('T')[0]
      };
      apiCall = apiService.createBloodPressure(data);
    } else if (type === 'weight') {
      const weight = parseFloat(formData.weight.weight);
      const height = parseFloat(formData.weight.height);
      const bmi = (weight / Math.pow(height / 100, 2)).toFixed(1);
      data = {
        weight,
        height,
        bmi: parseFloat(bmi),
        date: formData.weight.date
      };
      apiCall = apiService.createBodyMetrics(data);
    }

    try {
      await apiCall;
      onSave(data);
      toast({
        title: 'Success!',
        description: 'Health metric logged successfully',
      });
      setOpen(false);
    } catch (error) {
      console.error('Failed to save metric:', error);
      toast({
        title: 'Error',
        description: 'Failed to save health metric. Please try again.',
        variant: 'destructive'
      });
    }
  };

  const getModalContent = () => {
    switch(type) {
      case 'glucose':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="glucose-value">Blood Glucose (mg/dL) *</Label>
              <Input
                id="glucose-value"
                type="number"
                placeholder="95"
                value={formData.glucose.value}
                onChange={(e) => setFormData({
                  ...formData,
                  glucose: { ...formData.glucose, value: e.target.value }
                })}
                required
              />
            </div>
            <div>
              <Label htmlFor="glucose-time">Time</Label>
              <Input
                id="glucose-time"
                type="time"
                value={formData.glucose.time}
                onChange={(e) => setFormData({
                  ...formData,
                  glucose: { ...formData.glucose, time: e.target.value }
                })}
              />
            </div>
            <div>
              <Label htmlFor="meal-context">Meal Context</Label>
              <Select 
                value={formData.glucose.mealContext} 
                onValueChange={(value) => setFormData({
                  ...formData,
                  glucose: { ...formData.glucose, mealContext: value }
                })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Fasting">Fasting</SelectItem>
                  <SelectItem value="Before Breakfast">Before Breakfast</SelectItem>
                  <SelectItem value="After Breakfast">After Breakfast</SelectItem>
                  <SelectItem value="Before Lunch">Before Lunch</SelectItem>
                  <SelectItem value="After Lunch">After Lunch</SelectItem>
                  <SelectItem value="Before Dinner">Before Dinner</SelectItem>
                  <SelectItem value="After Dinner">After Dinner</SelectItem>
                  <SelectItem value="Bedtime">Bedtime</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );
      case 'bp':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="systolic">Systolic *</Label>
                <Input
                  id="systolic"
                  type="number"
                  placeholder="120"
                  value={formData.bp.systolic}
                  onChange={(e) => setFormData({
                    ...formData,
                    bp: { ...formData.bp, systolic: e.target.value }
                  })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="diastolic">Diastolic *</Label>
                <Input
                  id="diastolic"
                  type="number"
                  placeholder="80"
                  value={formData.bp.diastolic}
                  onChange={(e) => setFormData({
                    ...formData,
                    bp: { ...formData.bp, diastolic: e.target.value }
                  })}
                  required
                />
              </div>
            </div>
            <div>
              <Label htmlFor="pulse">Pulse (bpm)</Label>
              <Input
                id="pulse"
                type="number"
                placeholder="72"
                value={formData.bp.pulse}
                onChange={(e) => setFormData({
                  ...formData,
                  bp: { ...formData.bp, pulse: e.target.value }
                })}
              />
            </div>
            <div>
              <Label htmlFor="bp-time">Time</Label>
              <Input
                id="bp-time"
                type="time"
                value={formData.bp.time}
                onChange={(e) => setFormData({
                  ...formData,
                  bp: { ...formData.bp, time: e.target.value }
                })}
              />
            </div>
          </div>
        );
      case 'weight':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="weight">Weight (kg) *</Label>
              <Input
                id="weight"
                type="number"
                step="0.1"
                placeholder="75"
                value={formData.weight.weight}
                onChange={(e) => setFormData({
                  ...formData,
                  weight: { ...formData.weight, weight: e.target.value }
                })}
                required
              />
            </div>
            <div>
              <Label htmlFor="height">Height (cm) *</Label>
              <Input
                id="height"
                type="number"
                placeholder="170"
                value={formData.weight.height}
                onChange={(e) => setFormData({
                  ...formData,
                  weight: { ...formData.weight, height: e.target.value }
                })}
                required
              />
            </div>
            <div>
              <Label htmlFor="weight-date">Date</Label>
              <Input
                id="weight-date"
                type="date"
                value={formData.weight.date}
                onChange={(e) => setFormData({
                  ...formData,
                  weight: { ...formData.weight, date: e.target.value }
                })}
              />
            </div>
            {formData.weight.weight && formData.weight.height && (
              <div className="p-3 bg-emerald-50 rounded-lg">
                <p className="text-sm text-gray-600">Calculated BMI</p>
                <p className="text-2xl font-bold text-emerald-700">
                  {(parseFloat(formData.weight.weight) / Math.pow(parseFloat(formData.weight.height) / 100, 2)).toFixed(1)}
                </p>
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  const getTitle = () => {
    switch(type) {
      case 'glucose': return 'Log Blood Glucose';
      case 'bp': return 'Log Blood Pressure';
      case 'weight': return 'Log Weight & Height';
      default: return 'Log Health Metric';
    }
  };

  const getIcon = () => {
    switch(type) {
      case 'glucose': return <Activity className="w-5 h-5" />;
      case 'bp': return <Heart className="w-5 h-5" />;
      case 'weight': return <Weight className="w-5 h-5" />;
      default: return <Plus className="w-5 h-5" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
          <Plus className="w-4 h-4 mr-1" />
          Log
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getIcon()}
            {getTitle()}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {getModalContent()}
          <div className="flex gap-3 pt-4">
            <Button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700">
              Save Reading
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default LogHealthMetricModal;
