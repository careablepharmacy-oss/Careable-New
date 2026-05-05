import React, { useState, useEffect } from 'react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { Plus, X, Upload } from 'lucide-react';
import { toast } from '../hooks/use-toast';

/**
 * Reusable Medication Form Component
 * 
 * @param {Object} props
 * @param {Object} props.initialData - Initial form data (for edit mode)
 * @param {boolean} props.isEditMode - Whether form is in edit mode
 * @param {boolean} props.isPrescriptionManager - Show additional prescription manager fields
 * @param {Function} props.onSubmit - Called when form is submitted with medication data
 * @param {Function} props.onCancel - Called when cancel button is clicked
 * @param {boolean} props.loading - External loading state
 * @param {string} props.submitButtonText - Custom submit button text
 */
const MedicationForm = ({
  initialData = null,
  isEditMode = false,
  isPrescriptionManager = false,
  onSubmit,
  onCancel,
  loading = false,
  submitButtonText = null
}) => {
  const [formData, setFormData] = useState({
    name: '',
    dosage: '',
    form: 'Tablet',
    color: '#FF6B6B',
    instructions: '',
    frequency: 'daily',
    times: ['09:00'],
    dosageTimings: [{ time: '09:00', amount: '' }],
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    weeklyDays: [],
    refillEnabled: true,
    // Stock tracking fields
    tabletStockCount: '',
    injectionIuRemaining: 0,
    injectionIuPerMl: 0,
    injectionIuPerPackage: 0,
    injectionMlVolume: 0,
    injectionStockCount: 0,
    // Prescription manager specific fields
    tabletsPerStrip: '',
    costPerUnit: '',
    includeInInvoice: true,
    medicineOrderLink: '',
    medicineInvoiceLink: '',
    medicineInvoiceAmount: '',
    injectionOrderLink: '',
    injectionInvoiceLink: '',
    injectionInvoiceAmount: ''
  });

  // Autocomplete state
  const [searchResults, setSearchResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState(null);
  
  // Injection IU data state
  const [injectionData, setInjectionData] = useState(null);
  const [loadingInjectionData, setLoadingInjectionData] = useState(false);
  
  // Validation error state
  const [validationErrors, setValidationErrors] = useState({
    dosageTimings: false,
    tabletStockCount: false,
    injectionStockCount: false,
    tabletsPerStrip: false,
    injectionMlVolume: false,
    injectionIuPerMl: false
  });

  // Clear validation error when field is edited
  const clearValidationError = (fieldName) => {
    if (validationErrors[fieldName]) {
      setValidationErrors(prev => ({ ...prev, [fieldName]: false }));
    }
  };

  // Load initial data when provided
  useEffect(() => {
    if (initialData) {
      const dosageTimings = initialData.schedule?.dosage_timings || [];
      const legacyTimes = initialData.schedule?.times || ['09:00'];
      
      const timings = dosageTimings.length > 0 
        ? dosageTimings 
        : legacyTimes.map(t => ({ time: t, amount: '' }));
      
      setFormData({
        name: initialData.name || '',
        dosage: initialData.dosage || '',
        form: initialData.form || 'Tablet',
        color: initialData.color || '#FF6B6B',
        instructions: initialData.instructions || '',
        frequency: initialData.schedule?.frequency || 'daily',
        times: legacyTimes,
        dosageTimings: timings,
        startDate: initialData.schedule?.start_date || new Date().toISOString().split('T')[0],
        endDate: initialData.schedule?.end_date || '',
        weeklyDays: initialData.schedule?.weekly_days || [],
        refillEnabled: initialData.refill_reminder?.enabled || false,
        tabletStockCount: initialData.tablet_stock_count || '',
        injectionIuRemaining: initialData.injection_iu_remaining || 0,
        injectionMlVolume: initialData.injection_ml_volume || 0,
        injectionIuPerMl: initialData.injection_iu_per_ml || 0,
        injectionIuPerPackage: initialData.injection_iu_per_package || 0,
        injectionStockCount: initialData.injection_stock_count || 0,
        // Prescription manager fields
        tabletsPerStrip: initialData.tablets_per_strip != null ? String(initialData.tablets_per_strip) : '',
        costPerUnit: initialData.cost_per_unit || '',
        includeInInvoice: initialData.include_in_invoice !== false,
        medicineOrderLink: initialData.medicine_order_link || '',
        medicineInvoiceLink: initialData.medicine_invoice_link || '',
        medicineInvoiceAmount: initialData.medicine_invoice_amount || '',
        injectionOrderLink: initialData.injection_order_link || '',
        injectionInvoiceLink: initialData.injection_invoice_link || '',
        injectionInvoiceAmount: initialData.injection_invoice_amount || ''
      });
    }
  }, [initialData]);

  const handleAddTime = () => {
    setFormData(prev => ({ 
      ...prev, 
      times: [...prev.times, '12:00'],
      dosageTimings: [...prev.dosageTimings, { time: '12:00', amount: '' }]
    }));
  };

  const handleRemoveTime = (index) => {
    setFormData(prev => ({ 
      ...prev, 
      times: prev.times.filter((_, i) => i !== index),
      dosageTimings: prev.dosageTimings.filter((_, i) => i !== index)
    }));
  };

  // Convert 24h time to 12h format for display
  const to12Hour = (time24) => {
    if (!time24) return { hour: '09', minute: '00', period: 'AM' };
    const [h, m] = time24.split(':');
    const hour24 = parseInt(h);
    const period = hour24 >= 12 ? 'PM' : 'AM';
    const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
    return { hour: String(hour12).padStart(2, '0'), minute: m || '00', period };
  };

  // Convert 12h format back to 24h for storage
  const to24Hour = (hour, minute, period) => {
    let h = parseInt(hour);
    if (period === 'AM' && h === 12) h = 0;
    else if (period === 'PM' && h !== 12) h += 12;
    return `${String(h).padStart(2, '0')}:${minute}`;
  };

  const handleTimeChange = (index, value) => {
    const newTimes = [...formData.times];
    newTimes[index] = value;
    const newDosageTimings = [...formData.dosageTimings];
    newDosageTimings[index] = { ...newDosageTimings[index], time: value };
    setFormData(prev => ({ ...prev, times: newTimes, dosageTimings: newDosageTimings }));
  };
  
  const handleDosageAmountChange = (index, value) => {
    const newDosageTimings = [...formData.dosageTimings];
    newDosageTimings[index] = { ...newDosageTimings[index], amount: value };
    setFormData(prev => ({ ...prev, dosageTimings: newDosageTimings }));
  };
  
  // Fetch injection IU data when form changes to Injection or name changes
  const fetchInjectionData = async (medicineName) => {
    if (!medicineName || medicineName.length < 3) {
      return;
    }
    
    try {
      setLoadingInjectionData(true);
      const url = `${process.env.REACT_APP_BACKEND_URL}/api/medications/injection-iu?name=${encodeURIComponent(medicineName)}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.found) {
        setInjectionData(data);
        const mlVolume = data.ml || 0;
        const iuPerMl = data.iu_per_package || 0;
        const totalIuPerPackage = mlVolume * iuPerMl;
        
        setFormData(prev => ({
          ...prev,
          injectionMlVolume: mlVolume,
          injectionIuPerMl: iuPerMl,
          injectionIuPerPackage: totalIuPerPackage,
          injectionStockCount: prev.injectionStockCount || 0,
          injectionIuRemaining: prev.injectionStockCount > 0 
            ? prev.injectionStockCount * totalIuPerPackage 
            : 0
        }));
        
        toast({
          title: 'Injection Data Found',
          description: `${data.name}: ${mlVolume}ml × ${iuPerMl} IU/ml = ${totalIuPerPackage} IU per vial`,
        });
      } else {
        setInjectionData(null);
      }
    } catch (error) {
      console.error('Failed to fetch injection data:', error);
      setInjectionData(null);
    } finally {
      setLoadingInjectionData(false);
    }
  };
  
  // Watch for form type changes to Injection
  useEffect(() => {
    if (formData.form === 'Injection' && formData.name) {
      fetchInjectionData(formData.name);
    }
  }, [formData.form]);

  // Autocomplete search function with debouncing
  const handleMedicineNameChange = (value) => {
    console.log('[Autocomplete] Input changed:', value);
    setFormData(prev => ({ ...prev, name: value }));

    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    if (value.length < 2) {
      console.log('[Autocomplete] Query too short, skipping search');
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        const url = `${process.env.REACT_APP_BACKEND_URL}/api/medications/autocomplete?q=${encodeURIComponent(value)}`;
        console.log('[Autocomplete] Searching:', url);
        
        const response = await fetch(url);
        console.log('[Autocomplete] Response status:', response.status);
        
        const results = await response.json();
        console.log('[Autocomplete] Results:', results.length, 'medicines found');
        
        setSearchResults(results);
        setShowDropdown(results.length > 0);
      } catch (error) {
        console.error('[Autocomplete] Search failed:', error);
        setSearchResults([]);
        setShowDropdown(false);
      }
    }, 300);

    setSearchTimeout(timeout);
  };

  const handleSelectMedicine = (medicineName) => {
    setFormData(prev => ({ ...prev, name: medicineName }));
    setShowDropdown(false);
    setSearchResults([]);
  };

  const handleWeeklyDayToggle = (day) => {
    const newWeeklyDays = formData.weeklyDays.includes(day)
      ? formData.weeklyDays.filter(d => d !== day)
      : [...formData.weeklyDays, day];
    setFormData(prev => ({ ...prev, weeklyDays: newWeeklyDays }));
  };

  const weekDays = [
    { value: 'sunday', label: 'Sun' },
    { value: 'monday', label: 'Mon' },
    { value: 'tuesday', label: 'Tue' },
    { value: 'wednesday', label: 'Wed' },
    { value: 'thursday', label: 'Thu' },
    { value: 'friday', label: 'Fri' },
    { value: 'saturday', label: 'Sat' }
  ];

  const colorOptions = [
    { value: '#FF6B6B', label: 'Red' },
    { value: '#4ECDC4', label: 'Teal' },
    { value: '#FFD93D', label: 'Yellow' },
    { value: '#95E1D3', label: 'Mint' },
    { value: '#A8E6CF', label: 'Green' },
    { value: '#C7CEEA', label: 'Purple' },
    { value: '#FFA07A', label: 'Orange' }
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation for weekly frequency
    if (formData.frequency === 'weekly' && formData.weeklyDays.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'Please select at least one day for weekly schedule',
        variant: 'destructive'
      });
      return;
    }
    
    // Validation for reminder times
    if (formData.frequency !== 'as-needed' && formData.dosageTimings.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'Please add at least one reminder time',
        variant: 'destructive'
      });
      return;
    }
    
    // Validation for dosage amount
    if (formData.frequency !== 'as-needed' && (formData.form === 'Tablet' || formData.form === 'Capsule' || formData.form === 'Injection')) {
      const emptyAmounts = formData.dosageTimings.filter(timing => !timing.amount || timing.amount.trim() === '');
      if (emptyAmounts.length > 0) {
        setValidationErrors(prev => ({ ...prev, dosageTimings: true }));
        toast({
          title: 'Validation Error',
          description: `Please enter dosage amount for all reminder times (${formData.form === 'Injection' ? 'IU' : 'count'})`,
          variant: 'destructive'
        });
        // Scroll to and focus the first empty dosage field
        const firstEmptyIndex = formData.dosageTimings.findIndex(timing => !timing.amount || timing.amount.trim() === '');
        const dosageField = document.querySelector(`[data-testid="dosage-amount-${firstEmptyIndex}"]`);
        if (dosageField) {
          dosageField.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(() => dosageField.focus(), 300);
        }
        return;
      }
    }
    
    // Validation for stock count
    if (formData.form === 'Tablet' || formData.form === 'Capsule') {
      if (!formData.tabletStockCount || formData.tabletStockCount <= 0) {
        setValidationErrors(prev => ({ ...prev, tabletStockCount: true }));
        toast({
          title: 'Validation Error',
          description: 'Please enter stock count for tablets/capsules',
          variant: 'destructive'
        });
        // Scroll to and focus the stock count field
        const stockField = document.querySelector('[data-testid="tablet-stock-count"]');
        if (stockField) {
          stockField.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(() => stockField.focus(), 300);
        }
        return;
      }
      
      // Prescription manager: validate tablets per strip
      if (isPrescriptionManager && (!formData.tabletsPerStrip || formData.tabletsPerStrip <= 0)) {
        setValidationErrors(prev => ({ ...prev, tabletsPerStrip: true }));
        toast({
          title: 'Validation Error',
          description: 'Please enter number of tablets/capsules per strip',
          variant: 'destructive'
        });
        const stripField = document.querySelector('[data-testid="tablets-per-strip"]');
        if (stripField) {
          stripField.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(() => stripField.focus(), 300);
        }
        return;
      }
    }
    
    if (formData.form === 'Injection') {
      if (!formData.injectionMlVolume || formData.injectionMlVolume <= 0) {
        setValidationErrors(prev => ({ ...prev, injectionMlVolume: true }));
        toast({
          title: 'Validation Error',
          description: 'Please enter Volume (ml) for injection',
          variant: 'destructive'
        });
        const volumeField = document.querySelector('[data-testid="injection-ml-volume"]');
        if (volumeField) {
          volumeField.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(() => volumeField.focus(), 300);
        }
        return;
      }
      if (!formData.injectionIuPerMl || formData.injectionIuPerMl <= 0) {
        setValidationErrors(prev => ({ ...prev, injectionIuPerMl: true }));
        toast({
          title: 'Validation Error',
          description: 'Please enter IU/ml (concentration) for injection',
          variant: 'destructive'
        });
        const iuField = document.querySelector('[data-testid="injection-iu-per-ml"]');
        if (iuField) {
          iuField.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(() => iuField.focus(), 300);
        }
        return;
      }
      if (!formData.injectionStockCount || formData.injectionStockCount <= 0) {
        toast({
          title: 'Validation Error',
          description: 'Please enter stock count for injection',
          variant: 'destructive'
        });
        return;
      }
    }

    // Build medication data object
    const medicationData = {
      name: formData.name,
      dosage: formData.dosage || '',
      form: formData.form,
      color: formData.color,
      instructions: formData.instructions,
      schedule: {
        frequency: formData.frequency,
        times: formData.times,
        dosage_timings: formData.dosageTimings,
        start_date: formData.startDate,
        end_date: formData.endDate || null,
        weekly_days: formData.frequency === 'weekly' ? formData.weeklyDays : []
      },
      refill_reminder: {
        enabled: formData.refillEnabled,
        pills_remaining: 0,
        threshold: 7
      }
    };
    
    // Add stock tracking fields based on form type
    if (formData.form === 'Tablet' || formData.form === 'Capsule') {
      medicationData.tablet_stock_count = parseInt(formData.tabletStockCount) || 0;
      
      // Prescription manager fields
      if (isPrescriptionManager) {
        medicationData.tablets_per_strip = parseInt(formData.tabletsPerStrip) || 0;
      }
    } else if (formData.form === 'Injection') {
      const stockCount = parseInt(formData.injectionStockCount) || 0;
      const iuPerMl = parseFloat(formData.injectionIuPerMl) || 0;
      const mlVolume = parseFloat(formData.injectionMlVolume) || 0;
      const iuPerPackage = mlVolume * iuPerMl;
      const totalIuAvailable = stockCount * iuPerPackage;
      
      medicationData.injection_ml_volume = mlVolume;
      medicationData.injection_iu_per_ml = iuPerMl;
      medicationData.injection_iu_per_package = iuPerPackage;
      medicationData.injection_stock_count = stockCount;
      medicationData.injection_iu_remaining = totalIuAvailable;
    }
    
    // Add prescription manager specific fields
    if (isPrescriptionManager) {
      if (formData.costPerUnit) {
        medicationData.cost_per_unit = parseFloat(formData.costPerUnit) || 0;
      }
      medicationData.include_in_invoice = formData.includeInInvoice;
      if (formData.medicineOrderLink) {
        medicationData.medicine_order_link = formData.medicineOrderLink;
      }
      if (formData.medicineInvoiceLink) {
        medicationData.medicine_invoice_link = formData.medicineInvoiceLink;
      }
      if (formData.medicineInvoiceAmount) {
        medicationData.medicine_invoice_amount = parseFloat(formData.medicineInvoiceAmount) || 0;
      }
      if (formData.injectionOrderLink) {
        medicationData.injection_order_link = formData.injectionOrderLink;
      }
      if (formData.injectionInvoiceLink) {
        medicationData.injection_invoice_link = formData.injectionInvoiceLink;
      }
      if (formData.injectionInvoiceAmount) {
        medicationData.injection_invoice_amount = parseFloat(formData.injectionInvoiceAmount) || 0;
      }
    }

    // Call the onSubmit callback with the medication data
    if (onSubmit) {
      onSubmit(medicationData);
    }
  };

  const defaultSubmitText = isEditMode ? 'Update Medication' : 'Save Medication';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Information */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">Basic Information</h2>
        
        {/* Medication Name with Autocomplete */}
        <div className="relative">
          <Label htmlFor="name">Medication Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => handleMedicineNameChange(e.target.value)}
            onFocus={() => {
              if (searchResults.length > 0) {
                setShowDropdown(true);
              }
            }}
            onBlur={() => {
              setTimeout(() => setShowDropdown(false), 200);
            }}
            placeholder="Start typing medicine name..."
            required
            autoComplete="off"
            data-testid="medication-name-input"
          />
          
          {/* Autocomplete Dropdown */}
          {showDropdown && searchResults.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {searchResults.map((medicine, index) => (
                <div
                  key={index}
                  onClick={() => handleSelectMedicine(medicine.name)}
                  className="px-4 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                  data-testid={`autocomplete-option-${index}`}
                >
                  <span className="text-gray-900">{medicine.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Form Type */}
        <div>
          <Label htmlFor="form">Form *</Label>
          <Select value={formData.form} onValueChange={(value) => setFormData(prev => ({ ...prev, form: value }))}>
            <SelectTrigger data-testid="medication-form-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Tablet">Tablet</SelectItem>
              <SelectItem value="Capsule">Capsule</SelectItem>
              <SelectItem value="Syrup">Syrup</SelectItem>
              <SelectItem value="Injection">Injection</SelectItem>
              <SelectItem value="Inhaler">Inhaler</SelectItem>
              <SelectItem value="Drops">Drops</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* Tablet/Capsule Stock Fields */}
        {(formData.form === 'Tablet' || formData.form === 'Capsule') && (
          <div className="space-y-4">
            <div className={`p-4 bg-amber-50 rounded-lg border-2 ${validationErrors.tabletStockCount ? 'border-red-500 animate-pulse' : 'border-amber-300'}`}>
              <Label htmlFor="tabletStockCount" className="text-amber-900 font-semibold">
                Stock Count (Total Tablets/Capsules) *
              </Label>
              <Input
                id="tabletStockCount"
                type="number"
                value={formData.tabletStockCount}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, tabletStockCount: e.target.value === '' ? '' : (parseInt(e.target.value) || 0) }));
                  clearValidationError('tabletStockCount');
                }}
                placeholder="e.g., 30"
                min="1"
                required
                className={`mt-2 border-2 ${validationErrors.tabletStockCount ? 'border-red-500 bg-red-50' : 'border-amber-400 focus:border-amber-500'}`}
                data-testid="tablet-stock-count"
              />
              <p className="text-xs text-amber-700 mt-2 font-medium">
                📦 Required: Total number of tablets/capsules you have
              </p>
              {validationErrors.tabletStockCount && (
                <p className="text-xs text-red-600 mt-1 font-semibold animate-pulse">
                  ⚠️ Please enter stock count
                </p>
              )}
            </div>
            
            {/* Prescription Manager Only: Tablets per Strip */}
            {isPrescriptionManager && (
              <div className={`p-4 bg-blue-50 rounded-lg border-2 ${validationErrors.tabletsPerStrip ? 'border-red-500 animate-pulse' : 'border-blue-300'}`}>
                <Label htmlFor="tabletsPerStrip" className="text-blue-900 font-semibold">
                  Number of Tablets/Capsules per Strip *
                </Label>
                <Input
                  id="tabletsPerStrip"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={formData.tabletsPerStrip}
                  onChange={(e) => {
                    // Keep raw string state — only digits allowed; final parseInt happens at submit.
                    // Avoids `<input type="number">` reformatting quirks (Capacitor / locale issues)
                    // that were silently changing the saved strip count.
                    const raw = (e.target.value || '').replace(/[^0-9]/g, '');
                    setFormData(prev => ({ ...prev, tabletsPerStrip: raw }));
                    clearValidationError('tabletsPerStrip');
                  }}
                  placeholder="e.g., 10"
                  required
                  className={`mt-2 border-2 ${validationErrors.tabletsPerStrip ? 'border-red-500 bg-red-50' : 'border-blue-400 focus:border-blue-500'}`}
                  data-testid="tablets-per-strip"
                />
                <p className="text-xs text-blue-700 mt-2 font-medium">
                  💊 Required: How many tablets/capsules are in each strip?
                </p>
                {validationErrors.tabletsPerStrip && (
                  <p className="text-xs text-red-600 mt-1 font-semibold animate-pulse">
                    ⚠️ Please enter tablets per strip
                  </p>
                )}
              </div>
            )}
          </div>
        )}
        
        {/* Injection Fields */}
        {formData.form === 'Injection' && (
          <div className="space-y-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between">
              <Label className="text-blue-900">Injection Details</Label>
              {loadingInjectionData && <span className="text-xs text-blue-600">Loading data...</span>}
            </div>
            
            {injectionData && (
              <div className="bg-white p-3 rounded border border-blue-300">
                <p className="text-sm font-semibold text-blue-900">✓ Found: {injectionData.name}</p>
                <p className="text-xs text-gray-600">
                  Volume: {injectionData.ml}ml | IU/Package: {injectionData.iu_per_package}
                </p>
              </div>
            )}
            
            {!injectionData && !loadingInjectionData && formData.name.length > 2 && (
              <div className="bg-orange-50 p-3 rounded border-2 border-orange-300">
                <p className="text-sm font-semibold text-orange-900">ℹ️ Medicine not found in database</p>
                <p className="text-xs text-orange-700 mt-1">
                  Please enter the Volume and Concentration (IU/ml) manually below
                </p>
              </div>
            )}
            
            <div className={`grid grid-cols-2 gap-3 p-3 rounded-lg ${!injectionData && formData.name.length > 2 ? 'bg-orange-50 border-2 border-orange-300' : ''}`}>
              <div>
                <Label htmlFor="injectionMlVolume" className={!injectionData && formData.name.length > 2 ? 'text-orange-900 font-semibold' : ''}>
                  Volume (ml) *
                </Label>
                <Input
                  id="injectionMlVolume"
                  type="number"
                  step="0.1"
                  value={formData.injectionMlVolume}
                  onChange={(e) => {
                    const ml = parseFloat(e.target.value) || 0;
                    const iuPerMl = parseFloat(formData.injectionIuPerMl) || 0;
                    const totalIuPerPackage = ml * iuPerMl;
                    setFormData({ 
                      ...formData, 
                      injectionMlVolume: ml,
                      injectionIuPerPackage: totalIuPerPackage,
                      injectionIuRemaining: formData.injectionStockCount * totalIuPerPackage
                    });
                    clearValidationError('injectionMlVolume');
                  }}
                  placeholder="e.g., 3"
                  required
                  min="0.1"
                  data-testid="injection-ml-volume"
                  className={`mt-1 ${validationErrors.injectionMlVolume ? 'border-2 border-red-500 bg-red-50 animate-pulse' : (!injectionData && formData.name.length > 2 ? 'border-2 border-orange-400 focus:border-orange-500' : '')}`}
                />
                {validationErrors.injectionMlVolume && (
                  <p className="text-xs text-red-600 mt-1 font-semibold animate-pulse">⚠️ Required</p>
                )}
              </div>
              <div>
                <Label htmlFor="injectionIuPerMl" className={!injectionData && formData.name.length > 2 ? 'text-orange-900 font-semibold' : ''}>
                  IU/ml *
                </Label>
                <Input
                  id="injectionIuPerMl"
                  type="number"
                  value={formData.injectionIuPerMl}
                  onChange={(e) => {
                    const iuPerMl = parseFloat(e.target.value) || 0;
                    const ml = parseFloat(formData.injectionMlVolume) || 0;
                    const totalIuPerPackage = ml * iuPerMl;
                    setFormData({ 
                      ...formData, 
                      injectionIuPerMl: iuPerMl,
                      injectionIuPerPackage: totalIuPerPackage,
                      injectionIuRemaining: formData.injectionStockCount * totalIuPerPackage
                    });
                    clearValidationError('injectionIuPerMl');
                  }}
                  placeholder="e.g., 100"
                  required
                  min="1"
                  data-testid="injection-iu-per-ml"
                  className={`mt-1 ${validationErrors.injectionIuPerMl ? 'border-2 border-red-500 bg-red-50 animate-pulse' : (!injectionData && formData.name.length > 2 ? 'border-2 border-orange-400 focus:border-orange-500' : '')}`}
                />
                {validationErrors.injectionIuPerMl && (
                  <p className="text-xs text-red-600 mt-1 font-semibold animate-pulse">⚠️ Required</p>
                )}
              </div>
            </div>
            
            <div>
              <Label htmlFor="injectionIuPerPackage">Total IU per vial/pen</Label>
              <Input
                id="injectionIuPerPackage"
                type="number"
                value={formData.injectionIuPerPackage}
                disabled
                className="bg-gray-100 cursor-not-allowed"
                placeholder="Auto-calculated"
              />
              <p className="text-xs text-gray-500 mt-1">
                {formData.injectionMlVolume > 0 && formData.injectionIuPerMl > 0 
                  ? `${formData.injectionMlVolume}ml × ${formData.injectionIuPerMl} IU/ml = ${formData.injectionIuPerPackage} IU`
                  : 'Calculated from Volume × IU/ml'
                }
              </p>
            </div>
            
            <div className="p-3 bg-amber-50 rounded-lg border-2 border-amber-300">
              <Label htmlFor="injectionStockCount" className="text-amber-900 font-semibold">
                Stock Count *
              </Label>
              <Input
                id="injectionStockCount"
                type="number"
                value={formData.injectionStockCount}
                onChange={(e) => {
                  const stockCount = parseInt(e.target.value) || 0;
                  const iuPerPackage = parseFloat(formData.injectionIuPerPackage) || 0;
                  setFormData({ 
                    ...formData, 
                    injectionStockCount: stockCount,
                    injectionIuRemaining: stockCount * iuPerPackage
                  });
                }}
                placeholder="e.g., 2"
                min="1"
                required
                className="mt-2 border-2 border-amber-400 focus:border-amber-500"
              />
              <p className="text-xs text-amber-700 mt-2 font-medium">
                📦 Required: Number of vials/pens you have
              </p>
            </div>
            
            {formData.injectionStockCount > 0 && formData.injectionIuPerPackage > 0 && (
              <div className="bg-green-50 p-3 rounded border border-green-300">
                <p className="text-sm font-semibold text-green-900">
                  Total IU Available: {(formData.injectionStockCount * formData.injectionIuPerPackage).toFixed(0)} IU
                </p>
                <p className="text-xs text-gray-600">
                  {formData.injectionStockCount} vial{formData.injectionStockCount !== 1 ? 's' : ''} × {formData.injectionIuPerPackage} IU per vial
                </p>
              </div>
            )}
          </div>
        )}
        
        {(formData.form === 'Syrup' || formData.form === 'Drops' || formData.form === 'Inhaler') && (
          <div className="p-3 bg-gray-50 rounded border border-gray-200">
            <p className="text-sm text-gray-600">
              ℹ️ Stock tracking is not available for {formData.form}
            </p>
          </div>
        )}

        {/* Color Tag */}
        <div>
          <Label htmlFor="color">Color Tag</Label>
          <div className="flex gap-2 mt-2">
            {colorOptions.map(color => (
              <button
                key={color.value}
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, color: color.value }))}
                className={`w-10 h-10 rounded-full transition-all duration-200 ${
                  formData.color === color.value ? 'ring-4 ring-blue-500 ring-offset-2 scale-110' : 'hover:scale-110'
                }`}
                style={{ backgroundColor: color.value }}
                data-testid={`color-option-${color.label.toLowerCase()}`}
              />
            ))}
          </div>
        </div>

        {/* When to Take */}
        <div>
          <Label htmlFor="instructions">When to Take</Label>
          <Select 
            value={formData.instructions} 
            onValueChange={(value) => setFormData(prev => ({ ...prev, instructions: value }))}
          >
            <SelectTrigger data-testid="instructions-select">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Before food">Before food</SelectItem>
              <SelectItem value="After food">After food</SelectItem>
              <SelectItem value="Along with food">Along with food</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Schedule */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">Schedule</h2>
        
        <div>
          <Label htmlFor="frequency">Frequency</Label>
          <Select value={formData.frequency} onValueChange={(value) => setFormData(prev => ({ ...prev, frequency: value, weeklyDays: [] }))}>
            <SelectTrigger data-testid="frequency-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="as-needed">As Needed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {formData.frequency === 'weekly' && (
          <div>
            <Label>Select Days *</Label>
            <div className="grid grid-cols-7 gap-2 mt-2">
              {weekDays.map((day) => (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => handleWeeklyDayToggle(day.value)}
                  className={`py-2 px-1 text-sm rounded-lg border-2 transition-all duration-200 ${
                    formData.weeklyDays.includes(day.value)
                      ? 'bg-blue-600 text-white border-blue-600 font-semibold'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                  }`}
                  data-testid={`day-${day.value}`}
                >
                  {day.label}
                </button>
              ))}
            </div>
            {formData.weeklyDays.length > 0 && (
              <p className="text-sm text-gray-500 mt-2">
                Selected: {formData.weeklyDays.map(d => weekDays.find(wd => wd.value === d)?.label).join(', ')}
              </p>
            )}
          </div>
        )}

        {formData.frequency !== 'as-needed' && (
          <div className="p-4 bg-purple-50 rounded-lg border-2 border-purple-300">
            <div className="flex items-center justify-between mb-3">
              <Label className="text-purple-900 font-semibold">
                Reminder Times & Dosage *
              </Label>
              <Button type="button" size="sm" variant="outline" onClick={handleAddTime} className="border-purple-400 text-purple-700 hover:bg-purple-100">
                <Plus className="w-4 h-4 mr-1" />
                Add Time
              </Button>
            </div>
            <div className="space-y-2">
              {formData.dosageTimings.map((timing, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <div className="flex-1">
                    <div className="flex gap-1 items-center">
                      <select
                        value={to12Hour(timing.time).hour}
                        onChange={(e) => {
                          const { minute, period } = to12Hour(timing.time);
                          handleTimeChange(index, to24Hour(e.target.value, minute, period));
                        }}
                        className="w-[60px] h-10 rounded-md border border-input bg-background px-2 text-sm"
                        data-testid={`time-hour-${index}`}
                      >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
                          <option key={h} value={String(h).padStart(2, '0')}>{String(h).padStart(2, '0')}</option>
                        ))}
                      </select>
                      <span className="text-gray-500 font-bold">:</span>
                      <select
                        value={to12Hour(timing.time).minute}
                        onChange={(e) => {
                          const { hour, period } = to12Hour(timing.time);
                          handleTimeChange(index, to24Hour(hour, e.target.value, period));
                        }}
                        className="w-[60px] h-10 rounded-md border border-input bg-background px-2 text-sm"
                        data-testid={`time-minute-${index}`}
                      >
                        {Array.from({ length: 60 }, (_, i) => i).map(m => (
                          <option key={m} value={String(m).padStart(2, '0')}>{String(m).padStart(2, '0')}</option>
                        ))}
                      </select>
                      <select
                        value={to12Hour(timing.time).period}
                        onChange={(e) => {
                          const { hour, minute } = to12Hour(timing.time);
                          handleTimeChange(index, to24Hour(hour, minute, e.target.value));
                        }}
                        className="w-[60px] h-10 rounded-md border border-input bg-background px-2 text-sm font-medium"
                        data-testid={`time-period-${index}`}
                      >
                        <option value="AM">AM</option>
                        <option value="PM">PM</option>
                      </select>
                    </div>
                  </div>
                  {(formData.form === 'Tablet' || formData.form === 'Capsule' || formData.form === 'Injection') && (
                    <div className="flex-1">
                      <Input
                        type="text"
                        value={timing.amount}
                        onChange={(e) => {
                          handleDosageAmountChange(index, e.target.value);
                          clearValidationError('dosageTimings');
                        }}
                        placeholder={
                          formData.form === 'Injection' 
                            ? 'IU (e.g., 15)' 
                            : 'Count (e.g., 2)'
                        }
                        data-testid={`dosage-amount-${index}`}
                        className={validationErrors.dosageTimings && (!timing.amount || timing.amount.trim() === '') 
                          ? 'border-2 border-red-500 animate-pulse bg-red-50' 
                          : ''}
                      />
                    </div>
                  )}
                  {formData.dosageTimings.length > 1 && (
                    <Button type="button" size="sm" variant="ghost" onClick={() => handleRemoveTime(index)}>
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            {validationErrors.dosageTimings && (
              <p className="text-sm text-red-600 mt-2 font-semibold animate-pulse bg-red-50 p-2 rounded">
                ⚠️ Please enter dosage amount for all reminder times
              </p>
            )}
            {(formData.form === 'Tablet' || formData.form === 'Capsule') && (
              <p className="text-xs text-purple-700 mt-3 font-medium">
                ⏰ Required: Enter the number of tablets/capsules to take at each time
              </p>
            )}
            {formData.form === 'Injection' && (
              <p className="text-xs text-purple-700 mt-3 font-medium">
                ⏰ Required: Enter the IU (International Units) to take at each time
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="startDate">Start Date</Label>
            <Input
              id="startDate"
              type="date"
              value={formData.startDate}
              onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
              data-testid="start-date-input"
            />
          </div>
          <div>
            <Label htmlFor="endDate">End Date (Optional)</Label>
            <Input
              id="endDate"
              type="date"
              value={formData.endDate}
              onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
              min={formData.startDate}
              data-testid="end-date-input"
            />
          </div>
        </div>
      </div>

      {/* Prescription Manager Only: Cost & Links */}
      {isPrescriptionManager && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">Cost & Order Information</h2>
          
          {/* Cost per Unit */}
          <div>
            <Label htmlFor="costPerUnit">Cost per Unit (₹)</Label>
            <Input
              id="costPerUnit"
              type="text"
              inputMode="decimal"
              value={formData.costPerUnit}
              onChange={(e) => setFormData(prev => ({ ...prev, costPerUnit: e.target.value }))}
              placeholder="e.g., 25.50"
              data-testid="cost-per-unit-input"
            />
            <p className="text-xs text-gray-500 mt-1">
              Cost per tablet/capsule/vial
            </p>
          </div>

          {/* Include in Invoice Calculation */}
          <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
            <input
              type="checkbox"
              id="includeInInvoice"
              checked={formData.includeInInvoice}
              onChange={(e) => setFormData(prev => ({ ...prev, includeInInvoice: e.target.checked }))}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
              data-testid="include-in-invoice-checkbox"
            />
            <div>
              <Label htmlFor="includeInInvoice" className="font-medium text-amber-900 cursor-pointer">
                Add to Invoice Calculation
              </Label>
              <p className="text-xs text-amber-700 mt-1">
                Include this medicine in the monthly savings calculation shown on the Home Page
              </p>
            </div>
          </div>
          
        </div>
      )}

      {/* Refill Reminder */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">Refill Reminder</h2>
        
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div>
            <Label htmlFor="refillEnabled" className="font-semibold">Enable Refill Reminders</Label>
            <p className="text-sm text-gray-500 mt-1">Get notified when medication stock is running low</p>
          </div>
          <Switch
            id="refillEnabled"
            checked={formData.refillEnabled}
            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, refillEnabled: checked }))}
            data-testid="refill-enabled-switch"
          />
        </div>
      </div>

      {/* Submit Buttons */}
      <div className="space-y-3 pt-4">
        <Button 
          type="submit" 
          disabled={loading} 
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 text-lg"
          data-testid="submit-medication-btn"
        >
          {loading ? 'Saving...' : (submitButtonText || defaultSubmitText)}
        </Button>
        {onCancel && (
          <Button 
            type="button" 
            variant="outline" 
            className="w-full" 
            onClick={onCancel}
            data-testid="cancel-medication-btn"
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
};

export default MedicationForm;
