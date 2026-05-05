import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { ArrowLeft, Battery, AlertTriangle, X } from 'lucide-react';
import { toast } from '../hooks/use-toast';
import apiService from '../services/api';
import notificationManager from '../services/notificationManager';
import MedicationForm from '../components/MedicationForm';
import batteryOptimizationService from '../services/batteryOptimizationService';

const AddMedicationPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = !!id;
  const [loading, setLoading] = useState(false);
  const [initialData, setInitialData] = useState(null);
  const [pageLoading, setPageLoading] = useState(isEditMode);
  const [showBatteryPrompt, setShowBatteryPrompt] = useState(false);

  // Check battery optimization on mount
  useEffect(() => {
    checkBatteryOptimization();
  }, []);

  // Load medication data in edit mode
  useEffect(() => {
    if (isEditMode) {
      loadMedicationData();
    }
  }, [id]);

  const checkBatteryOptimization = async () => {
    try {
      const shouldShow = await batteryOptimizationService.shouldShowBatteryOptimizationPrompt();
      setShowBatteryPrompt(shouldShow);
    } catch (error) {
      console.error('Error checking battery optimization:', error);
    }
  };

  const handleOpenBatterySettings = async () => {
    try {
      await batteryOptimizationService.openBatteryOptimizationSettings();
      // Recheck after user returns (with a delay)
      setTimeout(async () => {
        const shouldShow = await batteryOptimizationService.shouldShowBatteryOptimizationPrompt();
        setShowBatteryPrompt(shouldShow);
      }, 1000);
    } catch (error) {
      console.error('Error opening battery settings:', error);
      toast({
        title: 'Error',
        description: 'Could not open battery settings. Please go to Settings > Apps > Careable 360+ > Battery and select "Unrestricted".',
        variant: 'destructive'
      });
    }
  };

  const handleDismissBatteryPrompt = () => {
    batteryOptimizationService.dismissPrompt();
    setShowBatteryPrompt(false);
  };

  const loadMedicationData = async () => {
    try {
      setPageLoading(true);
      const medications = await apiService.getMedications();
      const medication = medications.find(m => m.id === id);
      
      if (medication) {
        setInitialData(medication);
      } else {
        toast({
          title: 'Error',
          description: 'Medication not found',
          variant: 'destructive'
        });
        navigate('/medications');
      }
    } catch (error) {
      console.error('Failed to load medication:', error);
      toast({
        title: 'Error',
        description: 'Failed to load medication data',
        variant: 'destructive'
      });
    } finally {
      setPageLoading(false);
    }
  };

  const handleSubmit = async (medicationData) => {
    setLoading(true);
    
    try {
      console.log('Submitting medication data:', medicationData);
      console.log('Times in schedule:', medicationData.schedule.times);

      let savedMedication;
      
      if (isEditMode) {
        const response = await apiService.updateMedication(id, medicationData);
        console.log('Update response:', response);
        
        // Cancel old notifications and reschedule
        await notificationManager.cancelMedicationReminders(id);
        savedMedication = { ...medicationData, id };
        
        toast({
          title: 'Success!',
          description: 'Medication updated successfully',
        });
      } else {
        savedMedication = await apiService.createMedication(medicationData);
        toast({
          title: 'Success!',
          description: 'Medication added successfully',
        });
      }
      
      // Schedule notifications if notifications are enabled
      if (notificationManager.isEnabled()) {
        await notificationManager.scheduleMedicationReminders(savedMedication);
        console.log(`Scheduled reminders for ${savedMedication.name}`);
      }
      
      navigate('/medications');
    } catch (error) {
      console.error('Failed to save medication:', error);
      toast({
        title: 'Error',
        description: `Failed to ${isEditMode ? 'update' : 'add'} medication. Please try again.`,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate('/medications');
  };

  if (pageLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading medication...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      <header className="bg-white border-b sticky top-0 z-30">
        <div className="p-4 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/medications')} className="h-10 w-10 p-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold text-gray-900">{isEditMode ? 'Edit Medication' : 'Add Medication'}</h1>
        </div>
      </header>

      {/* Battery Optimization Warning Banner */}
      {showBatteryPrompt && (
        <div className="mx-4 mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4 relative">
          <button 
            onClick={handleDismissBatteryPrompt}
            className="absolute top-2 right-2 text-amber-600 hover:text-amber-800 p-1"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-start gap-3">
            <div className="bg-amber-100 rounded-full p-2 shrink-0">
              <Battery className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1 pr-6">
              <h3 className="font-semibold text-amber-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Enable Reliable Alarms
              </h3>
              <p className="text-sm text-amber-700 mt-1">
                To ensure medication alarms ring even when your phone is locked, please disable battery optimization for this app.
              </p>
              <Button 
                onClick={handleOpenBatterySettings}
                size="sm"
                className="mt-3 bg-amber-600 hover:bg-amber-700 text-white"
              >
                Open Battery Settings
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="p-4">
        <Card className="p-6">
          <MedicationForm
            initialData={initialData}
            isEditMode={isEditMode}
            isPrescriptionManager={false}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            loading={loading}
          />
        </Card>
      </div>
    </div>
  );
};

export default AddMedicationPage;
