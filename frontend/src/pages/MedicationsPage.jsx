import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Pill, Plus, Search, Edit, Trash2, AlertCircle, PackagePlus, ShoppingCart, ExternalLink, Tag, Package } from 'lucide-react';
import apiService from '../services/api';
import BottomNav from '../components/BottomNav';
import { toast } from '../hooks/use-toast';
import notificationManager from '../services/notificationManager';

const MedicationsPage = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [medications, setMedications] = useState([]);
  const [purchaseLinks, setPurchaseLinks] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddStockModal, setShowAddStockModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedMedication, setSelectedMedication] = useState(null);
  const [stockAmount, setStockAmount] = useState('');
  const [deletingMedication, setDeletingMedication] = useState(null);

  useEffect(() => {
    fetchMedications();
    fetchPurchaseLinks();
  }, []);

  // Refetch when page becomes visible (e.g., after adding medication)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchMedications();
        fetchPurchaseLinks();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', fetchMedications);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', fetchMedications);
    };
  }, []);

  const fetchMedications = async () => {
    try {
      const data = await apiService.getMedications();
      setMedications(data);
    } catch (error) {
      console.error('Failed to fetch medications:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPurchaseLinks = async () => {
    try {
      const links = await apiService.getMyPurchaseLinks();
      setPurchaseLinks(links);
    } catch (error) {
      console.error('Failed to fetch purchase links:', error);
    }
  };

  const filteredMedications = medications.filter(med =>
    med.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calculate monthly medication costs
  const costCalculations = useMemo(() => {
    const SHIPPING_COST = 100;
    const DAYS_IN_MONTH = 30;
    
    let totalMonthlyCost = SHIPPING_COST; // Start with flat shipping
    let hasMedicines = false;
    let hasInjections = false;
    
    medications.forEach(med => {
      // Skip medicines not included in invoice calculation
      if (med.include_in_invoice === false) return;
      
      // Get daily consumption based on schedule
      let dailyConsumption = 0;
      
      if (med.schedule?.frequency === 'daily' && med.schedule?.dosage_timings?.length > 0) {
        // Sum up dosage amounts for each time slot
        med.schedule.dosage_timings.forEach(timing => {
          const amount = parseFloat(timing.amount) || 0;
          if (med.form === 'Tablet' || med.form === 'Capsule') {
            dailyConsumption += amount;
            hasMedicines = true;
          } else if (med.form === 'Injection') {
            // For injections, amount is in IU - need to calculate vials needed
            dailyConsumption += amount;
            hasInjections = true;
          }
        });
      } else if (med.schedule?.frequency === 'weekly' && med.schedule?.dosage_timings?.length > 0) {
        // Weekly: divide by 7 for daily average
        let weeklyTotal = 0;
        med.schedule.dosage_timings.forEach(timing => {
          weeklyTotal += parseFloat(timing.amount) || 0;
        });
        dailyConsumption = weeklyTotal / 7;
        
        if (med.form === 'Tablet' || med.form === 'Capsule') {
          hasMedicines = true;
        } else if (med.form === 'Injection') {
          hasInjections = true;
        }
      }
      
      // Calculate monthly need
      const monthlyNeed = dailyConsumption * DAYS_IN_MONTH;
      
      // Calculate cost if cost_per_unit is available
      if (med.cost_per_unit && monthlyNeed > 0) {
        if (med.form === 'Tablet' || med.form === 'Capsule') {
          // cost_per_unit is the cost of a strip, not a single tablet
          // Divide by tablets_per_strip to get cost per tablet
          const tabletsPerStrip = med.tablets_per_strip || 1;
          const costPerTablet = med.cost_per_unit / tabletsPerStrip;
          totalMonthlyCost += monthlyNeed * costPerTablet;
        } else if (med.form === 'Injection' && med.injection_iu_per_package) {
          // Calculate how many vials needed per month
          const vialsNeeded = Math.ceil(monthlyNeed / med.injection_iu_per_package);
          totalMonthlyCost += vialsNeeded * med.cost_per_unit;
        }
      }
    });
    
    // Use user-level purchase links instead of medication-level
    const totalInvoiceAmount = (purchaseLinks?.medicine_invoice_amount || 0) + (purchaseLinks?.injection_invoice_amount || 0);
    const medicineOrderLink = purchaseLinks?.medicine_order_link || null;
    const medicineInvoiceLink = purchaseLinks?.medicine_invoice_link || null;
    const injectionOrderLink = purchaseLinks?.injection_order_link || null;
    const injectionInvoiceLink = purchaseLinks?.injection_invoice_link || null;
    const hasMedicineLinks = !!medicineInvoiceLink && hasMedicines;
    const hasInjectionLinks = !!injectionInvoiceLink && hasInjections;
    
    const savings = totalMonthlyCost - totalInvoiceAmount;
    
    return {
      totalMonthlyCost: Math.round(totalMonthlyCost * 100) / 100,
      totalInvoiceAmount: Math.round(totalInvoiceAmount * 100) / 100,
      savings: Math.round(savings * 100) / 100,
      hasMedicineLinks,
      hasInjectionLinks,
      medicineOrderLink,
      medicineInvoiceLink,
      injectionOrderLink,
      injectionInvoiceLink,
      showPurchaseSection: !!medicineInvoiceLink || !!injectionInvoiceLink
    };
  }, [medications, purchaseLinks]);

  const handleDeleteClick = (medication) => {
    setDeletingMedication(medication);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingMedication) return;
    
    try {
      console.log('Deleting medication with ID:', deletingMedication.id);
      await apiService.deleteMedication(deletingMedication.id);
      
      // Cancel scheduled notifications for this medication
      await notificationManager.cancelMedicationReminders(deletingMedication.id);
      
      // Update local state
      setMedications(medications.filter(med => med.id !== deletingMedication.id));
      
      // Show success toast
      toast({
        title: 'Success!',
        description: 'Medication and reminders deleted successfully',
      });
      
      // Close modal
      setShowDeleteModal(false);
      setDeletingMedication(null);
      
      // Refetch to ensure sync
      await fetchMedications();
    } catch (error) {
      console.error('Failed to delete medication:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete medication. Please try again.',
        variant: 'destructive'
      });
    }
  };
  
  const handleAddStockClick = (medication) => {
    setSelectedMedication(medication);
    setStockAmount('');
    setShowAddStockModal(true);
  };
  
  const handleAddStock = async () => {
    if (!stockAmount || parseInt(stockAmount) <= 0) {
      toast({
        title: 'Invalid Amount',
        description: 'Please enter a valid stock amount',
        variant: 'destructive'
      });
      return;
    }
    
    try {
      const amount = parseInt(stockAmount);
      
      // Use apiService.request() to include auth token
      const result = await apiService.request(`/api/medications/${selectedMedication.id}/add-stock?amount=${amount}`, {
        method: 'POST'
      });
      
      toast({
        title: 'Success!',
        description: result.message || 'Stock added successfully',
      });
      
      setShowAddStockModal(false);
      setSelectedMedication(null);
      setStockAmount('');
      
      // Refresh medications list
      await fetchMedications();
    } catch (error) {
      console.error('Failed to add stock:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to add stock. Please try again.',
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="pb-20 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">My Medications</h1>
              <p className="text-sm text-gray-500">{medications.length} active</p>
            </div>
            <Button 
              onClick={() => navigate('/medications/add')}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="w-5 h-5" />
            </Button>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Search medications..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-gray-50"
            />
          </div>
        </div>
      </div>

      {/* Monthly Purchase Section - Prominent Display */}
      {costCalculations.showPurchaseSection && (
        <div className="p-4">
          <Card className="bg-gradient-to-br from-blue-600 to-blue-700 text-white p-5 shadow-lg">
            <div className="flex items-center gap-2 mb-4">
              <ShoppingCart className="w-6 h-6" />
              <h2 className="text-lg font-bold">Monthly Medicine Purchase</h2>
            </div>
            
            {/* Cost Summary */}
            <div className="bg-white/10 rounded-lg p-4 mb-4 space-y-3">
              {/* Calculated Monthly Cost */}
              <div className="flex justify-between items-center">
                <span className="text-blue-100">Estimated Monthly Cost:</span>
                <span className="text-xl font-bold">₹{costCalculations.totalMonthlyCost.toLocaleString('en-IN')}</span>
              </div>
              <p className="text-xs text-blue-200">
                (Based on dosage × 30 days + ₹100 shipping)
              </p>
              
              {/* Invoice Purchase Option */}
              {costCalculations.totalInvoiceAmount > 0 && (
                <>
                  <div className="border-t border-white/20 pt-3">
                    <div className="flex justify-between items-center">
                      <span className="text-blue-100">Purchase at Invoice Price:</span>
                      <span className="text-xl font-bold">₹{costCalculations.totalInvoiceAmount.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                  
                  {/* Savings Badge */}
                  {costCalculations.savings > 0 && (
                    <div className="flex items-center justify-center gap-2 bg-green-500 rounded-lg py-2 px-4">
                      <Tag className="w-5 h-5" />
                      <span className="font-bold text-lg">Save ₹{costCalculations.savings.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                </>
              )}
            </div>
            
            {/* Purchase Buttons */}
            <div className="grid grid-cols-1 gap-3">
              {costCalculations.hasMedicineLinks && costCalculations.medicineInvoiceLink && (
                <Button 
                  onClick={() => window.open(costCalculations.medicineInvoiceLink, '_blank')}
                  className="w-full bg-white text-blue-700 hover:bg-blue-50 font-semibold py-6"
                  data-testid="buy-medicines-btn"
                >
                  <ShoppingCart className="w-5 h-5 mr-2" />
                  Buy Medicines Now
                  <ExternalLink className="w-4 h-4 ml-2" />
                </Button>
              )}
              
              {costCalculations.hasInjectionLinks && costCalculations.injectionInvoiceLink && (
                <Button 
                  onClick={() => window.open(costCalculations.injectionInvoiceLink, '_blank')}
                  className="w-full bg-purple-500 hover:bg-purple-600 text-white font-semibold py-6"
                  data-testid="buy-injections-btn"
                >
                  <ShoppingCart className="w-5 h-5 mr-2" />
                  Buy Injections Now
                  <ExternalLink className="w-4 h-4 ml-2" />
                </Button>
              )}
            </div>
            
            {/* Order Tracking Section */}
            <div className="mt-4 pt-4 border-t border-white/20">
              <h4 className="text-sm font-medium text-blue-100 mb-3 flex items-center gap-2">
                <Package className="w-4 h-4" />
                Order Tracking
              </h4>
              
              {costCalculations.medicineOrderLink || costCalculations.injectionOrderLink ? (
                <div className="grid grid-cols-1 gap-2">
                  {costCalculations.medicineOrderLink && (
                    <Button 
                      onClick={() => { window.location.href = costCalculations.medicineOrderLink; }}
                      variant="outline"
                      className="w-full bg-white/10 border-white/30 text-white hover:bg-white/20 font-medium py-4"
                      data-testid="track-medicines-btn"
                    >
                      <Package className="w-4 h-4 mr-2" />
                      Track Medicine Order
                    </Button>
                  )}
                  {costCalculations.injectionOrderLink && (
                    <Button 
                      onClick={() => { window.location.href = costCalculations.injectionOrderLink; }}
                      variant="outline"
                      className="w-full bg-white/10 border-white/30 text-white hover:bg-white/20 font-medium py-4"
                      data-testid="track-injections-btn"
                    >
                      <Package className="w-4 h-4 mr-2" />
                      Track Injection Order
                    </Button>
                  )}
                </div>
              ) : (
                <div className="bg-white/10 rounded-lg p-4 text-center">
                  <p className="text-blue-100 text-sm mb-3">
                    No active orders to track
                  </p>
                  <Button 
                    onClick={() => navigate('/profile?tab=orders')}
                    className="bg-white text-blue-600 hover:bg-blue-50 font-medium"
                    data-testid="track-my-order-btn"
                  >
                    <Package className="w-4 h-4 mr-2" />
                    Track My Order
                  </Button>
                </div>
              )}
            </div>
            
            {!costCalculations.hasMedicineLinks && !costCalculations.hasInjectionLinks && (
              <p className="text-center text-blue-200 text-sm mt-4">
                Contact your prescription manager for purchase links
              </p>
            )}
          </Card>
        </div>
      )}

      {/* Medications List */}
      <div className="p-4 space-y-3">
        {filteredMedications.length === 0 ? (
          <Card className="p-8 text-center">
            <Pill className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <h3 className="font-semibold text-gray-900 mb-2">No medications found</h3>
            <p className="text-sm text-gray-500 mb-4">Add your first medication</p>
            <Button onClick={() => navigate('/medications/add')} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-5 h-5 mr-2" />
              Add Medication
            </Button>
          </Card>
        ) : (
          filteredMedications.map(med => (
            <Card key={med.id} className="p-4 shadow-sm">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: med.color + '30' }}>
                  <Pill className="w-7 h-7" style={{ color: med.color }} />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{med.name}</h3>
                  <p className="text-sm text-gray-600">{med.dosage} • {med.form}</p>
                  <p className="text-xs text-gray-500 mt-1">{med.instructions}</p>
                </div>
                <div className="flex gap-1">
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/medications/edit/${med.id}`);
                    }}
                    className="h-8 w-8 p-0 hover:bg-blue-50"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteClick(med);
                    }}
                    className="h-8 w-8 p-0 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Schedule</span>
                  <span className="font-medium text-gray-900">
                    {med.schedule.frequency === 'daily' ? 'Daily' : med.schedule.frequency}
                    {med.schedule.times.length > 0 && ` at ${med.schedule.times.join(', ')}`}
                  </span>
                </div>
                
                {/* Stock display for Tablets/Capsules */}
                {(med.form === 'Tablet' || med.form === 'Capsule') && med.tablet_stock_count !== undefined && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Stock</span>
                    <span className={`font-medium flex items-center gap-1 ${
                      med.tablet_stock_count < 10
                        ? 'text-red-600'
                        : med.tablet_stock_count < 20
                        ? 'text-orange-600'
                        : 'text-green-600'
                    }`}>
                      {med.tablet_stock_count} remaining
                      {med.tablet_stock_count < 20 && (
                        <AlertCircle className="w-4 h-4" />
                      )}
                    </span>
                  </div>
                )}
                
                {/* Stock display for Injections */}
                {med.form === 'Injection' && med.injection_stock_count !== undefined && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Vials/Pens</span>
                      <span className={`font-medium flex items-center gap-1 ${
                        med.injection_stock_count < 2
                          ? 'text-red-600'
                          : med.injection_stock_count < 3
                          ? 'text-orange-600'
                          : 'text-green-600'
                      }`}>
                        {med.injection_stock_count} remaining
                        {med.injection_stock_count < 3 && (
                          <AlertCircle className="w-4 h-4" />
                        )}
                      </span>
                    </div>
                    {med.injection_iu_remaining !== undefined && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">IU Remaining</span>
                        <span className="font-medium text-blue-600">
                          {med.injection_iu_remaining.toFixed(0)} IU
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {/* Add Stock Button */}
              {((med.form === 'Tablet' || med.form === 'Capsule') || med.form === 'Injection') && (
                <div className="mt-3">
                  <Button
                    onClick={() => handleAddStockClick(med)}
                    variant="outline"
                    size="sm"
                    className="w-full border-blue-300 text-blue-600 hover:bg-blue-50"
                  >
                    <PackagePlus className="w-4 h-4 mr-2" />
                    Add Stock
                  </Button>
                </div>
              )}
            </Card>
          ))
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && deletingMedication && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Delete Medication</h2>
            
            <div className="mb-6">
              <p className="text-sm text-gray-600 mb-2">
                Are you sure you want to delete this medication?
              </p>
              <p className="text-sm font-semibold text-gray-900 mb-2">
                {deletingMedication.name}
              </p>
              <p className="text-xs text-red-600">
                This action cannot be undone. All reminders will also be cancelled.
              </p>
            </div>
            
            <div className="flex gap-2">
              <Button
                onClick={handleDeleteConfirm}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                Delete
              </Button>
              <Button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeletingMedication(null);
                }}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Add Stock Modal */}
      {showAddStockModal && selectedMedication && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Add Stock</h2>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                Adding stock for: <span className="font-semibold text-gray-900">{selectedMedication.name}</span>
              </p>
              <p className="text-xs text-gray-500">
                Form: {selectedMedication.form}
              </p>
            </div>
            
            <div className="mb-4">
              <Label htmlFor="stockAmount">
                {selectedMedication.form === 'Injection' ? 'Number of Vials/Pens' : 'Number of Tablets/Capsules'}
              </Label>
              <Input
                id="stockAmount"
                type="number"
                value={stockAmount}
                onChange={(e) => setStockAmount(e.target.value)}
                placeholder="Enter amount"
                min="1"
                className="mt-1"
                autoFocus
              />
            </div>
            
            <div className="flex gap-2">
              <Button
                onClick={handleAddStock}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                Add Stock
              </Button>
              <Button
                onClick={() => {
                  setShowAddStockModal(false);
                  setSelectedMedication(null);
                  setStockAmount('');
                }}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      )}

      <BottomNav active="medications" />
    </div>
  );
};

export default MedicationsPage;
