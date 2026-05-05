import React, { useState, useEffect } from 'react';
import { Search, User, Users, Calendar, Phone, Mail, Filter, X, Eye, Edit, Trash2, Plus, Settings, Send, Check, AlertTriangle, Stethoscope, FlaskConical, Link, RotateCcw, BarChart3, Package, PackagePlus, TruckIcon, ClipboardList, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/api';
import { useToast } from '../hooks/use-toast';
import MedicationForm from '../components/MedicationForm';
import PurchaseLinksPanel from '../components/PurchaseLinksPanel';

const PrescriptionManagerDashboard = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('all'); // all, today, week, month
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [editUserForm, setEditUserForm] = useState({});
  const [savingUser, setSavingUser] = useState(false);
  const [showMedicationModal, setShowMedicationModal] = useState(false);
  const [showHealthModal, setShowHealthModal] = useState(false);
  const [medicationFormMode, setMedicationFormMode] = useState('add'); // add or edit
  const [selectedMedication, setSelectedMedication] = useState(null);
  const [userMedications, setUserMedications] = useState([]);
  const [userHealthReports, setUserHealthReports] = useState(null);
  const [showMedicationForm, setShowMedicationForm] = useState(false);
  const [showHealthForm, setShowHealthForm] = useState(false);
  const [healthFormType, setHealthFormType] = useState(''); // 'glucose', 'bp', 'metrics'
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [showDoctorBookingModal, setShowDoctorBookingModal] = useState(false);
  const [showLabBookingModal, setShowLabBookingModal] = useState(false);
  const [showPurchaseLinksModal, setShowPurchaseLinksModal] = useState(false);
  const [purchaseLinksForm, setPurchaseLinksForm] = useState({
    medicine_order_link: '',
    medicine_invoice_link: '',
    medicine_invoice_amount: '',
    injection_order_link: '',
    injection_invoice_link: '',
    injection_invoice_amount: ''
  });
  const DEFAULT_MEDICINE_ORDER_LINK = 'https://encaremedicineordertrackdummy.netlify.app';
  const [purchaseLinksLoading, setPurchaseLinksLoading] = useState(false);
  const [bookingForm, setBookingForm] = useState({
    date: '',
    time: '',
    notes: '',
    doctorName: '',
    hospitalName: '',
    labName: '',
    testType: ''
  });
  const [appointmentHistory, setAppointmentHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  // Database cleanup state
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const [cleanupPassword, setCleanupPassword] = useState('');
  const [cleanupResult, setCleanupResult] = useState(null);
  const [importingMedicines, setImportingMedicines] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadType, setUploadType] = useState(''); // 'medicines' or 'insulin'
  const [selectedFile, setSelectedFile] = useState(null);
  const [showWebhookSettings, setShowWebhookSettings] = useState(false);
  const [webhookConfig, setWebhookConfig] = useState(null);
  const [webhookForm, setWebhookForm] = useState({ webhook_url: '', enabled: true, description: '' });
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [webhookTestResult, setWebhookTestResult] = useState(null);
  // Order management state
  const [showOrdersPanel, setShowOrdersPanel] = useState(false);
  const [allOrders, setAllOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [orderSearchTerm, setOrderSearchTerm] = useState('');
  const [orderFilterStatus, setOrderFilterStatus] = useState('all');
  const [editingTrackingId, setEditingTrackingId] = useState(null);
  const [trackingInput, setTrackingInput] = useState('');
  const [medicationFormLoading, setMedicationFormLoading] = useState(false);
  const [showAddStockModal, setShowAddStockModal] = useState(false);
  const [stockMedication, setStockMedication] = useState(null);
  const [stockAmount, setStockAmount] = useState('');
  const [openMenu, setOpenMenu] = useState(null);

  // Close dropdown menus when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setOpenMenu(null);
    if (openMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [openMenu]);
  const [medicationForm, setMedicationForm] = useState({
    name: '',
    dosage: '',
    form: 'Tablet',
    frequency: 'Daily',
    times: ['09:00'],
    instructions: ''
  });
  const [healthForm, setHealthForm] = useState({
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().slice(0, 5),
    value: '',
    systolic: '',
    diastolic: '',
    pulse: '',
    weight: '',
    height: '',
    bmi: '',
    meal_context: 'Fasting'
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchAllUsers();
  }, []);

  // Auto-open Purchase Links modal when navigated from CRM with ?openPurchaseLinks=<userId>
  useEffect(() => {
    if (!users.length) return;
    const params = new URLSearchParams(window.location.search);
    const targetUserId = params.get("openPurchaseLinks");
    if (!targetUserId) return;
    const target = users.find(u => u.id === targetUserId);
    if (target) {
      handleManagePurchaseLinks(target);
      // strip query so a refresh doesn't reopen the modal
      window.history.replaceState({}, "", window.location.pathname);
    }
    // eslint-disable-next-line
  }, [users]);

  useEffect(() => {
    filterUsers();
  }, [users, searchTerm, dateFilter]);

  const fetchAllUsers = async () => {
    try {
      setLoading(true);
      const response = await apiService.getAllUsersForManager();
      setUsers(response.users || []);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load users',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const filterUsers = () => {
    let filtered = [...users];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (user) =>
          user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (user.phone && user.phone.includes(searchTerm))
      );
    }

    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      filtered = filtered.filter((user) => {
        const createdAt = new Date(user.created_at);
        const diffTime = Math.abs(now - createdAt);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (dateFilter === 'today') return diffDays <= 1;
        if (dateFilter === 'week') return diffDays <= 7;
        if (dateFilter === 'month') return diffDays <= 30;
        return true;
      });
    }

    setFilteredUsers(filtered);
  };

  const handleViewUser = async (user) => {
    try {
      console.log('[PrescriptionManager] Loading details for user:', user.id, user.email);
      const details = await apiService.getUserDetailsForManager(user.id);
      console.log('[PrescriptionManager] User details loaded:', details);
      setSelectedUser(details);
      setIsEditingUser(false);
      setShowUserModal(true);
    } catch (error) {
      console.error('[PrescriptionManager] Error loading user details:', error);
      toast({
        title: 'Error',
        description: `Failed to load user details: ${error.message}`,
        variant: 'destructive',
      });
    }
  };

  const handleEditUser = () => {
    setEditUserForm({
      name: selectedUser.name || '',
      phone: selectedUser.phone || '',
      age: selectedUser.age || '',
      sex: selectedUser.sex || '',
      address: selectedUser.address || '',
      city: selectedUser.city || '',
      state: selectedUser.state || '',
      country: selectedUser.country || 'India',
      pincode: selectedUser.pincode || '',
      relative_name: selectedUser.relative_name || '',
      relative_email: selectedUser.relative_email || '',
      relative_whatsapp: selectedUser.relative_whatsapp || ''
    });
    setIsEditingUser(true);
  };

  const handleSaveUser = async () => {
    if (!selectedUser) return;
    
    setSavingUser(true);
    try {
      await apiService.updateUserForManager(selectedUser.id, editUserForm);
      
      // Refresh user details
      const details = await apiService.getUserDetailsForManager(selectedUser.id);
      setSelectedUser(details);
      
      // Refresh users list
      fetchAllUsers();
      
      setIsEditingUser(false);
      toast({
        title: 'Success',
        description: 'User profile updated successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update user',
        variant: 'destructive',
      });
    } finally {
      setSavingUser(false);
    }
  };

  const handleViewMedications = async (user) => {
    try {
      console.log('[PrescriptionManager] Loading medications for user:', user.id, user.email);
      const response = await apiService.getUserMedicationsForManager(user.id);
      console.log('[PrescriptionManager] Medications loaded:', response);
      setUserMedications(response.medications || []);
      setSelectedUser(user);
      setShowMedicationModal(true);
    } catch (error) {
      console.error('[PrescriptionManager] Error loading medications:', error);
      toast({
        title: 'Error',
        description: `Failed to load medications: ${error.message}`,
        variant: 'destructive',
      });
    }
  };

  const handleViewHealthReports = async (user) => {
    try {
      console.log('[PrescriptionManager] Loading health reports for user:', user.id, user.email);
      const reports = await apiService.getUserHealthReportsForManager(user.id);
      console.log('[PrescriptionManager] Health reports loaded:', reports);
      setUserHealthReports(reports);
      setSelectedUser(user);
      setShowHealthModal(true);
    } catch (error) {
      console.error('[PrescriptionManager] Error loading health reports:', error);
      toast({
        title: 'Error',
        description: `Failed to load health reports: ${error.message}`,
        variant: 'destructive',
      });
    }
  };

  const handleDeleteMedication = async (medicationId) => {
    // Using a simple confirmation for medications (less critical than users)
    const confirmed = confirm('Are you sure you want to delete this medication?');
    if (!confirmed) return;

    try {
      await apiService.deleteMedicationForUser(selectedUser.id, medicationId);
      toast({
        title: 'Success',
        description: 'Medication deleted successfully',
      });
      // Refresh medications
      handleViewMedications(selectedUser);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete medication',
        variant: 'destructive',
      });
    }
  };

  const handleAddStockClick = (med) => {
    setStockMedication(med);
    setStockAmount('');
    setShowAddStockModal(true);
  };

  const handleAddStock = async () => {
    if (!stockAmount || parseInt(stockAmount) <= 0) {
      toast({ title: 'Invalid Amount', description: 'Please enter a valid stock amount', variant: 'destructive' });
      return;
    }
    try {
      const result = await apiService.addStockForUser(selectedUser.id, stockMedication.id, parseInt(stockAmount));
      toast({ title: 'Success', description: result.message || 'Stock added successfully' });
      setShowAddStockModal(false);
      setStockMedication(null);
      setStockAmount('');
      handleViewMedications(selectedUser);
    } catch (error) {
      toast({ title: 'Error', description: error.message || 'Failed to add stock', variant: 'destructive' });
    }
  };

  // ===== ORDER MANAGEMENT HANDLERS =====
  const fetchAllOrders = async () => {
    setOrdersLoading(true);
    try {
      const data = await apiService.getAdminOrders();
      setAllOrders(data);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to fetch orders', variant: 'destructive' });
    } finally {
      setOrdersLoading(false);
    }
  };

  const handleOpenOrdersPanel = () => {
    setShowOrdersPanel(true);
    fetchAllOrders();
  };

  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    try {
      await apiService.updateOrderStatus(orderId, { order_status: newStatus });
      toast({ title: 'Success', description: `Order status updated to ${newStatus}` });
      fetchAllOrders();
    } catch (error) {
      toast({ title: 'Error', description: error.message || 'Failed to update status', variant: 'destructive' });
    }
  };

  const handleSaveTracking = async (orderId) => {
    try {
      await apiService.updateOrderStatus(orderId, { tracking_number: trackingInput });
      toast({ title: 'Success', description: 'Tracking number updated' });
      setEditingTrackingId(null);
      setTrackingInput('');
      fetchAllOrders();
    } catch (error) {
      toast({ title: 'Error', description: error.message || 'Failed to update tracking', variant: 'destructive' });
    }
  };

  const filteredAllOrders = allOrders.filter(order => {
    const matchesSearch = !orderSearchTerm || 
      order.order_number?.toLowerCase().includes(orderSearchTerm.toLowerCase()) ||
      order.customer_name?.toLowerCase().includes(orderSearchTerm.toLowerCase()) ||
      order.customer_email?.toLowerCase().includes(orderSearchTerm.toLowerCase()) ||
      order.items?.some(i => i.product_name?.toLowerCase().includes(orderSearchTerm.toLowerCase()));
    const matchesStatus = orderFilterStatus === 'all' || order.order_status === orderFilterStatus;
    return matchesSearch && matchesStatus;
  });

  const orderStats = {
    total: allOrders.length,
    confirmed: allOrders.filter(o => o.order_status === 'confirmed').length,
    processing: allOrders.filter(o => o.order_status === 'processing').length,
    shipped: allOrders.filter(o => o.order_status === 'shipped').length,
    delivered: allOrders.filter(o => o.order_status === 'delivered').length,
  };

  const handleDeleteUser = (user) => {
    setUserToDelete(user);
    setShowDeleteConfirm(true);
  };

  // Handle booking doctor consultation for a user
  const handleBookDoctor = async (user) => {
    setSelectedUser(user);
    setLoadingHistory(true);
    setAppointmentHistory([]);
    setShowDoctorBookingModal(true);
    
    try {
      const history = await apiService.getUserAppointmentHistory(user.id, 5);
      // Filter for doctor appointments only
      const doctorHistory = history.filter(apt => apt.type === 'doctor');
      setAppointmentHistory(doctorHistory);
    } catch (error) {
      console.error('Error fetching appointment history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Handle booking lab test for a user
  const handleBookLabTest = async (user) => {
    setSelectedUser(user);
    setLoadingHistory(true);
    setAppointmentHistory([]);
    setShowLabBookingModal(true);
    
    try {
      const history = await apiService.getUserAppointmentHistory(user.id, 5);
      // Filter for lab appointments only
      const labHistory = history.filter(apt => apt.type === 'lab');
      setAppointmentHistory(labHistory);
    } catch (error) {
      console.error('Error fetching appointment history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Handle opening purchase links modal — fetch + save + reset are handled inside PurchaseLinksPanel
  const handleManagePurchaseLinks = (user) => {
    setSelectedUser(user);
    setShowPurchaseLinksModal(true);
  };

  // Handle saving / resetting purchase links — delegated to PurchaseLinksPanel
  // (kept here as no-ops for any old callers that may still reference these names).
  // eslint-disable-next-line no-unused-vars
  const handleSavePurchaseLinks = () => {};
  // eslint-disable-next-line no-unused-vars
  const handleResetPurchaseLinks = () => {};

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;

    try {
      await apiService.deleteUser(userToDelete.id);
      toast({
        title: 'Success',
        description: `User ${userToDelete.name} and all associated data deleted successfully`,
      });
      // Close modal and reset
      setShowDeleteConfirm(false);
      setUserToDelete(null);
      // Refresh user list
      fetchAllUsers();
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete user',
        variant: 'destructive',
      });
      setShowDeleteConfirm(false);
      setUserToDelete(null);
    }
  };

  const cancelDeleteUser = () => {
    setShowDeleteConfirm(false);
    setUserToDelete(null);
  };

  const handleCleanupDatabase = async () => {
    if (!cleanupPassword) {
      alert('Please enter the confirmation password');
      return;
    }

    try {
      const result = await apiService.cleanupProductionDatabase(cleanupPassword);
      
      setCleanupResult({
        success: true,
        message: result.message,
        deleted: result.deleted,
        remaining: result.remaining
      });
      
      // Refresh user list after cleanup
      await fetchAllUsers();
      
    } catch (error) {
      setCleanupResult({
        success: false,
        message: error.message || 'Database cleanup failed'
      });
    }
  };


  // Import insulin products (same method as 40K medicines import)
  const handleImportInsulinProducts = async () => {
    setImportingMedicines(true);
    setImportResult(null);

    try {
      const response = await apiService.request('/api/admin/import-insulin-products', {
        method: 'POST'
      });

      setImportResult({
        success: true,
        message: response.message,
        total: response.total_imported,
        samples: response.sample_products
      });

      toast({
        title: 'Success!',
        description: `Imported ${response.total_imported} insulin products successfully`,
      });
    } catch (error) {
      setImportResult({
        success: false,
        message: error.message || 'Import failed'
      });
      toast({
        title: 'Import Failed',
        description: error.message || 'Failed to import insulin products',
        variant: 'destructive',
      });
    } finally {
      setImportingMedicines(false);
    }
  };


  // Open upload modal
  const handleOpenUploadModal = (type) => {
    setUploadType(type);
    setSelectedFile(null);
    setImportResult(null);
    setShowUploadModal(true);
  };

  // Handle file selection
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'text/csv') {
      setSelectedFile(file);
    } else {
      toast({
        title: 'Invalid File',
        description: 'Please select a CSV file',
        variant: 'destructive',
      });
    }
  };

  // Upload CSV file
  const handleUploadCSV = async () => {
    if (!selectedFile) {
      toast({
        title: 'No File Selected',
        description: 'Please select a CSV file to upload',
        variant: 'destructive',
      });
      return;
    }

    setImportingMedicines(true);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('upload_type', uploadType);

      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/admin/upload-csv`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Upload failed' }));
        throw new Error(errorData.detail || 'Upload failed');
      }

      const result = await response.json();

      setImportResult({
        success: true,
        message: result.message,
        total: result.total_imported,
      });

      toast({
        title: 'Success!',
        description: `Imported ${result.total_imported} items successfully`,
      });

      setShowUploadModal(false);
    } catch (error) {
      setImportResult({
        success: false,
        message: error.message || 'Upload failed'
      });
      toast({
        title: 'Upload Failed',
        description: error.message || 'Failed to upload CSV',
        variant: 'destructive',
      });
    } finally {
      setImportingMedicines(false);
    }
  };

  
  // Simpler direct upload for insulin (sends CSV text directly)
  const handleDirectUpload = async () => {
    if (!selectedFile) {
      toast({
        title: 'No File Selected',
        description: 'Please select a CSV file to upload',
        variant: 'destructive',
      });
      return;
    }

    if (uploadType !== 'insulin') {
      toast({
        title: 'Error',
        description: 'Direct upload only works for insulin products',
        variant: 'destructive',
      });
      return;
    }

    setImportingMedicines(true);
    setImportResult(null);

    try {
      // Read file content as text
      const csvText = await selectedFile.text();

      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/admin/upload-insulin-direct`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'text/csv',
        },
        body: csvText,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Upload failed' }));
        throw new Error(errorData.detail || 'Upload failed');
      }

      const result = await response.json();

      setImportResult({
        success: true,
        message: result.message,
        total: result.total_imported,
      });

      toast({
        title: 'Success!',
        description: `Imported ${result.total_imported} insulin products successfully`,
      });

      setShowUploadModal(false);
    } catch (error) {
      setImportResult({
        success: false,
        message: error.message || 'Upload failed'
      });
      toast({
        title: 'Upload Failed',
        description: error.message || 'Failed to upload insulin products',
        variant: 'destructive',
      });
    } finally {
      setImportingMedicines(false);
    }
  };


  // Webhook Settings Handlers
  const handleOpenWebhookSettings = async () => {
    try {
      const config = await apiService.getWebhookConfig();
      setWebhookConfig(config);
      setWebhookForm({
        webhook_url: config.webhook_url || '',
        enabled: config.enabled !== false,
        description: config.description || ''
      });
      setShowWebhookSettings(true);
      setWebhookTestResult(null);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load webhook configuration',
        variant: 'destructive',
      });
    }
  };

  const handleSaveWebhookConfig = async () => {
    if (!webhookForm.webhook_url) {
      toast({
        title: 'Validation Error',
        description: 'Webhook URL is required',
        variant: 'destructive',
      });
      return;
    }

    if (!webhookForm.webhook_url.startsWith('http')) {
      toast({
        title: 'Validation Error',
        description: 'Webhook URL must start with http or https',
        variant: 'destructive',
      });
      return;
    }

    try {
      await apiService.updateWebhookConfig(
        webhookForm.webhook_url,
        webhookForm.enabled,
        webhookForm.description
      );
      toast({
        title: 'Success',
        description: 'Webhook configuration saved successfully',
      });
      // Refresh config
      const config = await apiService.getWebhookConfig();
      setWebhookConfig(config);
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save webhook configuration',
        variant: 'destructive',
      });
    }
  };

  const handleTestWebhook = async () => {
    setTestingWebhook(true);
    setWebhookTestResult(null);

    try {
      const result = await apiService.testWebhook();
      setWebhookTestResult({
        success: true,
        message: result.message,
        status_code: result.status_code
      });
      toast({
        title: 'Success',
        description: 'Test webhook sent successfully!',
      });
    } catch (error) {
      setWebhookTestResult({
        success: false,
        message: error.message || 'Failed to send test webhook'
      });
      toast({
        title: 'Error',
        description: error.message || 'Failed to send test webhook',
        variant: 'destructive',
      });
    } finally {
      setTestingWebhook(false);
    }
  };

  const handleAddMedicationClick = () => {
    setMedicationFormMode('add');
    setSelectedMedication(null);
    setShowMedicationForm(true);
  };

  const handleEditMedicationClick = (medication) => {
    setMedicationFormMode('edit');
    setSelectedMedication(medication);
    setShowMedicationForm(true);
  };

  // Handler for the new MedicationForm component
  const handleMedicationFormSubmit = async (medicationData) => {
    setMedicationFormLoading(true);
    
    try {
      if (medicationFormMode === 'add') {
        await apiService.createMedicationForUser(selectedUser.id, medicationData);
        toast({
          title: 'Success',
          description: 'Medication added successfully',
        });
      } else {
        await apiService.updateMedicationForUser(selectedUser.id, selectedMedication.id, medicationData);
        toast({
          title: 'Success',
          description: 'Medication updated successfully',
        });
      }

      setShowMedicationForm(false);
      handleViewMedications(selectedUser);
    } catch (error) {
      console.error('Error saving medication:', error);
      toast({
        title: 'Error',
        description: `Failed to ${medicationFormMode} medication: ${error.message}`,
        variant: 'destructive',
      });
    } finally {
      setMedicationFormLoading(false);
    }
  };

  const handleMedicationFormCancel = () => {
    setShowMedicationForm(false);
    setSelectedMedication(null);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-b from-blue-50 to-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Prescription Manager Dashboard</h1>
            <p className="text-gray-600">Manage medications and health reports for all users</p>
          </div>
          <div className="flex gap-3 flex-wrap items-center">
            {/* Analytics Dashboard - standalone */}
            <button
              onClick={() => navigate('/admin-dashboard')}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition shadow-md"
            >
              <BarChart3 className="w-5 h-5" />
              Analytics
            </button>

            {/* Manage E-Commerce dropdown */}
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === 'ecommerce' ? null : 'ecommerce'); }}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition shadow-md"
                data-testid="ecommerce-menu-btn"
              >
                <Package className="w-5 h-5" />
                Manage E-Commerce
                <ChevronDown className={`w-4 h-4 transition-transform ${openMenu === 'ecommerce' ? 'rotate-180' : ''}`} />
              </button>
              {openMenu === 'ecommerce' && (
                <div className="absolute top-full left-0 mt-1 w-56 bg-white rounded-lg shadow-lg border z-50">
                  <button
                    onClick={() => { navigate('/product-management'); setOpenMenu(null); }}
                    className="w-full flex items-center gap-2 px-4 py-3 text-sm text-gray-700 hover:bg-[#2BA89F]/10 rounded-t-lg"
                    data-testid="manage-products-btn"
                  >
                    <Package className="w-4 h-4" />
                    Manage Products
                  </button>
                  <button
                    onClick={() => { handleOpenOrdersPanel(); setOpenMenu(null); }}
                    className="w-full flex items-center gap-2 px-4 py-3 text-sm text-gray-700 hover:bg-[#2BA89F]/10 rounded-b-lg"
                    data-testid="manage-orders-btn"
                  >
                    <TruckIcon className="w-4 h-4" />
                    Manage Orders
                  </button>
                </div>
              )}
            </div>

            {/* Manage E-Pharmacy dropdown */}
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === 'epharmacy' ? null : 'epharmacy'); }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-md"
                data-testid="epharmacy-menu-btn"
              >
                <Plus className="w-5 h-5" />
                Manage E-Pharmacy
                <ChevronDown className={`w-4 h-4 transition-transform ${openMenu === 'epharmacy' ? 'rotate-180' : ''}`} />
              </button>
              {openMenu === 'epharmacy' && (
                <div className="absolute top-full left-0 mt-1 w-56 bg-white rounded-lg shadow-lg border z-50">
                  <button
                    onClick={() => { handleOpenUploadModal('medicines'); setOpenMenu(null); }}
                    className="w-full flex items-center gap-2 px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 rounded-t-lg"
                  >
                    <Plus className="w-4 h-4" />
                    Upload Medicine List
                  </button>
                  <button
                    onClick={() => { handleImportInsulinProducts(); setOpenMenu(null); }}
                    disabled={importingMedicines}
                    className="w-full flex items-center gap-2 px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 disabled:text-gray-400"
                  >
                    <Plus className="w-4 h-4" />
                    {importingMedicines ? 'Importing...' : 'Upload Insulin Products'}
                  </button>
                  <div className="border-t border-gray-100" />
                  <button
                    onClick={() => { navigate('/invoice-manager'); setOpenMenu(null); }}
                    className="w-full flex items-center gap-2 px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 rounded-b-lg font-medium"
                    data-testid="manage-invoice-delivery-btn"
                  >
                    <ClipboardList className="w-4 h-4" />
                    Manage Invoice & Delivery
                  </button>
                </div>
              )}
            </div>

            {/* Open CRM (Healthcare Assistant Portal) */}
            <button
              onClick={() => navigate('/crm')}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#1E3A5F] via-[#2BA89F] to-[#7AB648] text-white rounded-lg hover:opacity-90 transition shadow-md"
              data-testid="open-crm-btn"
            >
              <Users className="w-5 h-5" />
              Open CRM
            </button>

            {/* Settings dropdown */}
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === 'settings' ? null : 'settings'); }}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition shadow-md"
                data-testid="settings-menu-btn"
              >
                <Settings className="w-5 h-5" />
                Settings
                <ChevronDown className={`w-4 h-4 transition-transform ${openMenu === 'settings' ? 'rotate-180' : ''}`} />
              </button>
              {openMenu === 'settings' && (
                <div className="absolute top-full left-0 mt-1 w-56 bg-white rounded-lg shadow-lg border z-50">
                  <button
                    onClick={() => { handleOpenWebhookSettings(); setOpenMenu(null); }}
                    className="w-full flex items-center gap-2 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 rounded-t-lg"
                  >
                    <Settings className="w-4 h-4" />
                    Webhook
                  </button>
                  <button
                    onClick={() => { setShowCleanupModal(true); setOpenMenu(null); }}
                    className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-600 hover:bg-red-50 rounded-b-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                    Clean Database
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Users</p>
              <p className="text-2xl font-bold text-gray-900">{users.length}</p>
            </div>
            <User className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">New Today</p>
              <p className="text-2xl font-bold text-green-600">
                {users.filter((u) => {
                  const createdAt = new Date(u.created_at);
                  const diffDays = Math.ceil(Math.abs(new Date() - createdAt) / (1000 * 60 * 60 * 24));
                  return diffDays <= 1;
                }).length}
              </p>
            </div>
            <Calendar className="w-8 h-8 text-green-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">This Week</p>
              <p className="text-2xl font-bold text-purple-600">
                {users.filter((u) => {
                  const createdAt = new Date(u.created_at);
                  const diffDays = Math.ceil(Math.abs(new Date() - createdAt) / (1000 * 60 * 60 * 24));
                  return diffDays <= 7;
                }).length}
              </p>
            </div>
            <Calendar className="w-8 h-8 text-purple-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">This Month</p>
              <p className="text-2xl font-bold text-orange-600">
                {users.filter((u) => {
                  const createdAt = new Date(u.created_at);
                  const diffDays = Math.ceil(Math.abs(new Date() - createdAt) / (1000 * 60 * 60 * 24));
                  return diffDays <= 30;
                }).length}
              </p>
            </div>
            <Calendar className="w-8 h-8 text-orange-600" />
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by name, email, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Date Filter */}
          <div className="flex gap-2">
            <button
              onClick={() => setDateFilter('all')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                dateFilter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setDateFilter('today')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                dateFilter === 'today'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setDateFilter('week')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                dateFilter === 'week'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setDateFilter('month')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                dateFilter === 'month'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Month
            </button>
          </div>
        </div>
      </div>

        {/* Users Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Contact
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Joined
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredUsers.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 font-semibold">
                        {user.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">{user.name}</div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{user.phone || 'N/A'}</div>
                  <div className="text-sm text-gray-500">
                    {user.age && user.sex ? `${user.age}y, ${user.sex}` : 'N/A'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(user.created_at)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleViewUser(user)}
                      className="text-blue-600 hover:text-blue-900 p-1 hover:bg-blue-50 rounded"
                      title="View Details"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleViewMedications(user)}
                      className="text-green-600 hover:text-green-900 p-1 hover:bg-green-50 rounded"
                      title="Manage Medications"
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleViewHealthReports(user)}
                      className="text-purple-600 hover:text-purple-900 p-1 hover:bg-purple-50 rounded"
                      title="Health Reports"
                    >
                      <Mail className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleBookDoctor(user)}
                      className="text-cyan-600 hover:text-cyan-900 p-1 hover:bg-cyan-50 rounded"
                      title="Book Doctor Consultation"
                    >
                      <Stethoscope className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleManagePurchaseLinks(user)}
                      className="text-amber-600 hover:text-amber-900 p-1 hover:bg-amber-50 rounded"
                      title="Manage Purchase Links"
                    >
                      <Link className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDeleteUser(user)}
                      className="text-red-600 hover:text-red-900 p-1 hover:bg-red-50 rounded"
                      title="Delete User"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredUsers.length === 0 && (
          <div className="text-center py-12">
            <User className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No users found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm || dateFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'No users have registered yet'}
            </p>
          </div>
        )}
          </div>
        </div>

      {/* User Details Modal */}
      {showUserModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  {isEditingUser ? 'Edit User Profile' : 'User Details'}
                </h2>
                <div className="flex items-center gap-2">
                  {!isEditingUser && (
                    <button
                      onClick={handleEditUser}
                      className="px-4 py-2 bg-[#2BA89F] text-white rounded-lg hover:bg-[#1E8A82] transition flex items-center gap-2"
                    >
                      <Edit className="w-4 h-4" />
                      Edit Profile
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setShowUserModal(false);
                      setIsEditingUser(false);
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {isEditingUser ? (
                /* Edit Mode */
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                      <input
                        type="text"
                        value={editUserForm.name}
                        onChange={(e) => setEditUserForm({ ...editUserForm, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2BA89F] focus:border-transparent"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input
                        type="email"
                        value={selectedUser.email}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-100 text-gray-500"
                        disabled
                      />
                      <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number *</label>
                      <input
                        type="text"
                        value={editUserForm.phone}
                        onChange={(e) => setEditUserForm({ ...editUserForm, phone: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2BA89F] focus:border-transparent"
                        placeholder="+91 98765 43210"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
                      <input
                        type="number"
                        min="1"
                        max="120"
                        value={editUserForm.age}
                        onChange={(e) => setEditUserForm({ ...editUserForm, age: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2BA89F] focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Sex</label>
                      <select
                        value={editUserForm.sex}
                        onChange={(e) => setEditUserForm({ ...editUserForm, sex: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2BA89F] focus:border-transparent"
                      >
                        <option value="">Select</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Pincode</label>
                      <input
                        type="text"
                        maxLength="6"
                        value={editUserForm.pincode}
                        onChange={(e) => setEditUserForm({ ...editUserForm, pincode: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2BA89F] focus:border-transparent"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                      <input
                        type="text"
                        value={editUserForm.address}
                        onChange={(e) => setEditUserForm({ ...editUserForm, address: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2BA89F] focus:border-transparent"
                        placeholder="House No., Street, Area"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                      <input
                        type="text"
                        value={editUserForm.city}
                        onChange={(e) => setEditUserForm({ ...editUserForm, city: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2BA89F] focus:border-transparent"
                        placeholder="City"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                      <input
                        type="text"
                        value={editUserForm.state}
                        onChange={(e) => setEditUserForm({ ...editUserForm, state: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2BA89F] focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                      <input
                        type="text"
                        value={editUserForm.country}
                        onChange={(e) => setEditUserForm({ ...editUserForm, country: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2BA89F] focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h3 className="text-lg font-semibold mb-3">Emergency Contact</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Relative Name</label>
                        <input
                          type="text"
                          value={editUserForm.relative_name}
                          onChange={(e) => setEditUserForm({ ...editUserForm, relative_name: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2BA89F] focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Relative Email</label>
                        <input
                          type="email"
                          value={editUserForm.relative_email}
                          onChange={(e) => setEditUserForm({ ...editUserForm, relative_email: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2BA89F] focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Relative WhatsApp</label>
                        <input
                          type="text"
                          value={editUserForm.relative_whatsapp}
                          onChange={(e) => setEditUserForm({ ...editUserForm, relative_whatsapp: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2BA89F] focus:border-transparent"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={handleSaveUser}
                      disabled={savingUser}
                      className="flex-1 px-4 py-2 bg-[#2BA89F] text-white rounded-lg hover:bg-[#1E8A82] transition disabled:opacity-50"
                    >
                      {savingUser ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button
                      onClick={() => setIsEditingUser(false)}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* View Mode */
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Name</label>
                      <p className="text-gray-900">{selectedUser.name}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Email</label>
                      <p className="text-gray-900">{selectedUser.email}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Phone</label>
                      <p className="text-gray-900">{selectedUser.phone || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Age</label>
                      <p className="text-gray-900">{selectedUser.age || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Sex</label>
                      <p className="text-gray-900">{selectedUser.sex || 'N/A'}</p>
                    </div>
                    <div className="col-span-2">
                      <label className="text-sm font-medium text-gray-500">Address</label>
                      <p className="text-gray-900">
                        {selectedUser.address || 'N/A'}
                        {selectedUser.city && `, ${selectedUser.city}`}
                        {selectedUser.state && `, ${selectedUser.state}`}
                        {selectedUser.country && `, ${selectedUser.country}`}
                        {selectedUser.pincode && ` - ${selectedUser.pincode}`}
                      </p>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h3 className="text-lg font-semibold mb-3">Emergency Contact</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Relative Name</label>
                        <p className="text-gray-900">{selectedUser.relative_name || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Relative Email</label>
                        <p className="text-gray-900">{selectedUser.relative_email || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Relative WhatsApp</label>
                        <p className="text-gray-900">{selectedUser.relative_whatsapp || 'N/A'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Joined</label>
                        <p className="text-gray-900">{formatDate(selectedUser.created_at)}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Last Updated</label>
                        <p className="text-gray-900">{formatDate(selectedUser.updated_at)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Medications Modal (simplified for now) */}
      {showMedicationModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  Medications for {selectedUser.name}
                </h2>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => navigate(`/invoice-manager/invoices/create?userId=${selectedUser.id}`)}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
                    data-testid="generate-invoice-btn"
                  >
                    <ClipboardList className="w-5 h-5" />
                    Generate Invoice
                  </button>
                  <button
                    onClick={handleAddMedicationClick}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    <Plus className="w-5 h-5" />
                    Add Medication
                  </button>
                  <button
                    onClick={() => setShowMedicationModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-600">
                  Total Medications: <span className="font-semibold">{userMedications.length}</span>
                </p>
              </div>

              {userMedications.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500">No medications found for this user</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {userMedications.map((med) => (
                    <div key={med.id} className="border rounded-lg p-4 hover:shadow-md transition">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900">{med.name}</h3>
                          <p className="text-gray-600">
                            {med.dosage} • {med.form}
                          </p>
                          {med.instructions && (
                            <p className="text-sm text-gray-500 mt-1">{med.instructions}</p>
                          )}
                          <div className="mt-2 flex items-center gap-4 text-sm">
                            <span className="text-gray-600">
                              Frequency: <strong>{med.schedule.frequency}</strong>
                            </span>
                            <span className="text-gray-600">
                              Times: <strong>{med.schedule.times.join(', ')}</strong>
                            </span>
                          </div>
                          
                          {/* Stock Display */}
                          <div className="mt-3 flex flex-wrap items-center gap-3">
                            {/* Tablet/Capsule Stock */}
                            {(med.form === 'Tablet' || med.form === 'Capsule') && med.tablet_stock_count !== undefined && (
                              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                                med.tablet_stock_count < 10
                                  ? 'bg-red-100 text-red-700'
                                  : med.tablet_stock_count < 20
                                  ? 'bg-orange-100 text-orange-700'
                                  : 'bg-green-100 text-green-700'
                              }`}>
                                📦 Stock: {med.tablet_stock_count} {med.form}s
                              </span>
                            )}
                            
                            {/* Injection Stock */}
                            {med.form === 'Injection' && med.injection_stock_count !== undefined && (
                              <>
                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                                  med.injection_stock_count < 2
                                    ? 'bg-red-100 text-red-700'
                                    : med.injection_stock_count < 3
                                    ? 'bg-orange-100 text-orange-700'
                                    : 'bg-green-100 text-green-700'
                                }`}>
                                  💉 Vials: {med.injection_stock_count}
                                </span>
                                {med.injection_iu_remaining !== undefined && (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                                    IU: {med.injection_iu_remaining?.toFixed(0) || 0}
                                  </span>
                                )}
                              </>
                            )}
                            
                            {/* Cost per unit if available */}
                            {med.cost_per_unit && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                                ₹{med.cost_per_unit}/unit
                              </span>
                            )}
                            {med.include_in_invoice === false && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                                Not in invoice
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {(med.form === 'Tablet' || med.form === 'Capsule' || med.form === 'Injection') && (
                            <button
                              onClick={() => handleAddStockClick(med)}
                              className="text-emerald-600 hover:text-emerald-900 p-2 hover:bg-[#2BA89F]/10 rounded"
                              title="Add Stock"
                              data-testid={`pm-add-stock-${med.id}`}
                            >
                              <PackagePlus className="w-5 h-5" />
                            </button>
                          )}
                          <button
                            onClick={() => handleEditMedicationClick(med)}
                            className="text-blue-600 hover:text-blue-900 p-2 hover:bg-blue-50 rounded"
                            title="Edit Medication"
                          >
                            <Edit className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDeleteMedication(med.id)}
                            className="text-red-600 hover:text-red-900 p-2 hover:bg-red-50 rounded"
                            title="Delete Medication"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Medication Add/Edit Form Modal - Using MedicationForm Component */}
      {showMedicationForm && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  {medicationFormMode === 'add' ? 'Add' : 'Edit'} Medication for {selectedUser.name}
                </h2>
                <button
                  onClick={handleMedicationFormCancel}
                  className="text-gray-400 hover:text-gray-600"
                  data-testid="close-medication-form-btn"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <MedicationForm
                initialData={selectedMedication}
                isEditMode={medicationFormMode === 'edit'}
                isPrescriptionManager={true}
                onSubmit={handleMedicationFormSubmit}
                onCancel={handleMedicationFormCancel}
                loading={medicationFormLoading}
                submitButtonText={medicationFormMode === 'add' ? 'Add Medication' : 'Update Medication'}
              />
            </div>
          </div>
        </div>
      )}

      {/* Add Stock Modal */}
      {showAddStockModal && stockMedication && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Add Stock</h2>
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-1">
                Medicine: <span className="font-semibold text-gray-900">{stockMedication.name}</span>
              </p>
              <p className="text-xs text-gray-500">Form: {stockMedication.form}</p>
              {selectedUser && <p className="text-xs text-gray-500">Patient: {selectedUser.name}</p>}
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {stockMedication.form === 'Injection' ? 'Number of Vials/Pens' : 'Number of Tablets/Capsules'}
              </label>
              <input
                type="number"
                value={stockAmount}
                onChange={(e) => setStockAmount(e.target.value)}
                placeholder="Enter amount"
                min="1"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                autoFocus
                data-testid="pm-stock-amount-input"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAddStock}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 text-sm font-medium"
                data-testid="pm-stock-submit-btn"
              >
                Add Stock
              </button>
              <button
                onClick={() => { setShowAddStockModal(false); setStockMedication(null); setStockAmount(''); }}
                className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Orders Management Panel */}
      {showOrdersPanel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-6 border-b flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Order Management</h2>
                <p className="text-sm text-gray-500 mt-1">{allOrders.length} total orders</p>
              </div>
              <button onClick={() => setShowOrdersPanel(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Stats Row */}
            <div className="px-6 py-3 border-b bg-gray-50 flex gap-3 flex-wrap flex-shrink-0">
              {[
                { label: 'Total', count: orderStats.total, color: 'bg-gray-100 text-gray-700' },
                { label: 'Confirmed', count: orderStats.confirmed, color: 'bg-emerald-100 text-emerald-700' },
                { label: 'Processing', count: orderStats.processing, color: 'bg-blue-100 text-blue-700' },
                { label: 'Shipped', count: orderStats.shipped, color: 'bg-purple-100 text-purple-700' },
                { label: 'Delivered', count: orderStats.delivered, color: 'bg-green-100 text-green-700' },
              ].map(s => (
                <span key={s.label} className={`px-3 py-1 rounded-full text-xs font-semibold ${s.color}`}>
                  {s.label}: {s.count}
                </span>
              ))}
            </div>

            {/* Search & Filter */}
            <div className="px-6 py-3 border-b flex gap-3 flex-shrink-0">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by order #, customer, product..."
                  value={orderSearchTerm}
                  onChange={(e) => setOrderSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  data-testid="order-search-input"
                />
              </div>
              <select
                value={orderFilterStatus}
                onChange={(e) => setOrderFilterStatus(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                data-testid="order-filter-status"
              >
                <option value="all">All Statuses</option>
                <option value="confirmed">Confirmed</option>
                <option value="processing">Processing</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <button
                onClick={fetchAllOrders}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
              >
                Refresh
              </button>
            </div>

            {/* Orders Table */}
            <div className="flex-1 overflow-y-auto">
              {ordersLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : filteredAllOrders.length === 0 ? (
                <div className="text-center py-16 text-gray-500">
                  <ClipboardList className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="font-medium">No orders found</p>
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Order</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Customer</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Items</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Total</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tracking</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredAllOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-gray-50" data-testid={`order-row-${order.id}`}>
                        <td className="px-4 py-3">
                          <p className="text-sm font-bold text-gray-900">{order.order_number}</p>
                          <p className="text-xs text-gray-400">{order.payment_status === 'paid' ? 'Paid' : order.payment_status}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-gray-900">{order.customer_name}</p>
                          <p className="text-xs text-gray-500">{order.customer_email}</p>
                          {order.customer_phone && <p className="text-xs text-gray-400">{order.customer_phone}</p>}
                        </td>
                        <td className="px-4 py-3">
                          {order.items?.map((item, idx) => (
                            <p key={idx} className="text-xs text-gray-700">
                              {item.product_name} <span className="text-gray-400">x{item.quantity}</span>
                            </p>
                          ))}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm font-bold text-emerald-600">₹{order.total?.toLocaleString('en-IN')}</span>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={order.order_status}
                            onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value)}
                            className={`text-xs font-semibold px-2 py-1 rounded-lg border cursor-pointer ${
                              order.order_status === 'confirmed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                              order.order_status === 'processing' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                              order.order_status === 'shipped' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                              order.order_status === 'delivered' ? 'bg-green-50 text-green-700 border-green-200' :
                              order.order_status === 'cancelled' ? 'bg-red-50 text-red-700 border-red-200' :
                              'bg-yellow-50 text-yellow-700 border-yellow-200'
                            }`}
                            data-testid={`order-status-select-${order.id}`}
                          >
                            <option value="confirmed">Confirmed</option>
                            <option value="processing">Processing</option>
                            <option value="shipped">Shipped</option>
                            <option value="delivered">Delivered</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          {editingTrackingId === order.id ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={trackingInput}
                                onChange={(e) => setTrackingInput(e.target.value)}
                                placeholder="Enter tracking #"
                                className="text-xs border rounded px-2 py-1 w-28 focus:ring-1 focus:ring-blue-500"
                                autoFocus
                                data-testid={`tracking-input-${order.id}`}
                              />
                              <button
                                onClick={() => handleSaveTracking(order.id)}
                                className="text-emerald-600 hover:text-emerald-800 p-1"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => { setEditingTrackingId(null); setTrackingInput(''); }}
                                className="text-gray-400 hover:text-gray-600 p-1"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setEditingTrackingId(order.id); setTrackingInput(order.tracking_number || ''); }}
                              className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                              data-testid={`tracking-edit-${order.id}`}
                            >
                              {order.tracking_number || 'Add tracking'}
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-xs text-gray-500">
                            {order.created_at ? new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                          </p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Health Reports Modal (simplified) */}
      {showHealthModal && selectedUser && userHealthReports && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  Health Reports for {selectedUser.name}
                </h2>
                <button
                  onClick={() => setShowHealthModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Blood Glucose */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-semibold">Blood Glucose Readings</h3>
                    <button
                      onClick={() => {
                        toast({
                          title: 'Coming Soon',
                          description: 'Add glucose reading functionality will be available soon',
                        });
                      }}
                      className="flex items-center gap-1 px-3 py-1 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                    >
                      <Plus className="w-4 h-4" />
                      Add
                    </button>
                  </div>
                  {userHealthReports.blood_glucose.length === 0 ? (
                    <p className="text-gray-500 text-sm">No readings</p>
                  ) : (
                    <div className="space-y-2">
                      {userHealthReports.blood_glucose.slice(0, 5).map((reading) => (
                        <div
                          key={reading.id}
                          className="flex justify-between items-center p-3 bg-gray-50 rounded"
                        >
                          <span className="text-gray-900 font-medium">{reading.value} mg/dL</span>
                          <span className="text-gray-500 text-sm">
                            {reading.meal_context} • {formatDate(reading.date)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Blood Pressure */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-semibold">Blood Pressure Readings</h3>
                    <button
                      onClick={() => {
                        toast({
                          title: 'Coming Soon',
                          description: 'Add blood pressure reading functionality will be available soon',
                        });
                      }}
                      className="flex items-center gap-1 px-3 py-1 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                    >
                      <Plus className="w-4 h-4" />
                      Add
                    </button>
                  </div>
                  {userHealthReports.blood_pressure.length === 0 ? (
                    <p className="text-gray-500 text-sm">No readings</p>
                  ) : (
                    <div className="space-y-2">
                      {userHealthReports.blood_pressure.slice(0, 5).map((reading) => (
                        <div
                          key={reading.id}
                          className="flex justify-between items-center p-3 bg-gray-50 rounded"
                        >
                          <span className="text-gray-900 font-medium">
                            {reading.systolic}/{reading.diastolic} mmHg
                            {reading.pulse && ` • ${reading.pulse} bpm`}
                          </span>
                          <span className="text-gray-500 text-sm">{formatDate(reading.date)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Body Metrics */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-semibold">Body Metrics</h3>
                    <button
                      onClick={() => {
                        toast({
                          title: 'Coming Soon',
                          description: 'Add body metrics functionality will be available soon',
                        });
                      }}
                      className="flex items-center gap-1 px-3 py-1 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition"
                    >
                      <Plus className="w-4 h-4" />
                      Add
                    </button>
                  </div>
                  {userHealthReports.body_metrics.length === 0 ? (
                    <p className="text-gray-500 text-sm">No readings</p>
                  ) : (
                    <div className="space-y-2">
                      {userHealthReports.body_metrics.slice(0, 5).map((reading) => (
                        <div
                          key={reading.id}
                          className="flex justify-between items-center p-3 bg-gray-50 rounded"
                        >
                          <span className="text-gray-900 font-medium">
                            Weight: {reading.weight}kg • Height: {reading.height}cm • BMI:{' '}
                            {reading.bmi}
                          </span>
                          <span className="text-gray-500 text-sm">{formatDate(reading.date)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      {showDeleteConfirm && userToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              
              <h3 className="text-xl font-semibold text-center text-gray-900 mb-2">
                Delete User
              </h3>
              
              <p className="text-center text-gray-600 mb-4">
                Are you sure you want to delete <span className="font-semibold">{userToDelete.name}</span>?
              </p>
              
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <p className="text-sm font-medium text-red-800 mb-2">
                  This will permanently delete:
                </p>
                <ul className="text-sm text-red-700 space-y-1 list-disc list-inside">
                  <li>User account</li>
                  <li>All medications</li>
                  <li>All health records</li>
                  <li>All appointments</li>
                  <li>All associated data</li>
                </ul>
                <p className="text-sm font-semibold text-red-800 mt-3">
                  ⚠️ This action cannot be undone.
                </p>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={cancelDeleteUser}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteUser}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                >
                  Delete User
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Webhook Settings Modal */}
      {showWebhookSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* Header */}
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-12 h-12 bg-purple-100 rounded-full">
                    <Settings className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Webhook Configuration</h2>
                    <p className="text-sm text-gray-600">Manage missed medication webhook settings</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowWebhookSettings(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Info Box */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-blue-800">
                  <strong>How it works:</strong> When a user misses their medication (not marked as taken within 1 hour), 
                  the system will send a POST request to your webhook URL with user and family contact details.
                </p>
              </div>

              {/* Webhook URL Input */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Webhook URL <span className="text-red-500">*</span>
                </label>
                <input
                  type="url"
                  value={webhookForm.webhook_url}
                  onChange={(e) => setWebhookForm(prev => ({ ...prev, webhook_url: e.target.value }))}
                  placeholder="https://connect.pabbly.com/workflow/sendwebhookdata/..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter your Pabbly Connect or other webhook URL
                </p>
              </div>

              {/* Description (Optional) */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={webhookForm.description}
                  onChange={(e) => setWebhookForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Notes about this webhook configuration..."
                  rows="3"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              {/* Enable/Disable Toggle */}
              <div className="mb-6 flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900">Enable Webhook</p>
                  <p className="text-xs text-gray-500">Activate missed medication notifications</p>
                </div>
                <button
                  onClick={() => setWebhookForm(prev => ({ ...prev, enabled: !prev.enabled }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                    webhookForm.enabled ? 'bg-green-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                      webhookForm.enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Test Result Display */}
              {webhookTestResult && (
                <div
                  className={`mb-6 p-4 rounded-lg border ${
                    webhookTestResult.success
                      ? 'bg-green-50 border-green-200'
                      : 'bg-red-50 border-red-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {webhookTestResult.success ? (
                      <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p
                        className={`text-sm font-medium ${
                          webhookTestResult.success ? 'text-green-800' : 'text-red-800'
                        }`}
                      >
                        {webhookTestResult.success ? 'Test Successful!' : 'Test Failed'}
                      </p>
                      <p
                        className={`text-sm mt-1 ${
                          webhookTestResult.success ? 'text-green-700' : 'text-red-700'
                        }`}
                      >
                        {webhookTestResult.message}
                      </p>
                      {webhookTestResult.status_code && (
                        <p className="text-xs text-gray-600 mt-1">
                          Status Code: {webhookTestResult.status_code}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleSaveWebhookConfig}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium"
                >
                  <Check className="w-5 h-5" />
                  Save Configuration
                </button>
                <button
                  onClick={handleTestWebhook}
                  disabled={testingWebhook || !webhookForm.webhook_url}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5" />
                  {testingWebhook ? 'Sending...' : 'Test Fire Webhook'}
                </button>
              </div>

              {/* Additional Info */}
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600 font-medium mb-2">Sample Webhook Payload:</p>
                <pre className="text-xs bg-gray-900 text-green-400 p-3 rounded overflow-x-auto">
{`{
  "user_name": "John Doe",
  "user_email": "john@example.com",
  "user_phone": "+1234567890",
  "medication_name": "Metformin",
  "scheduled_time": "09:00",
  "missed_at": "2024-01-15T09:00:00Z",
  "family_member_name": "Jane Doe",
  "family_member_whatsapp": "+0987654321"
}`}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Database Cleanup Modal */}

      {/* CSV Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-900">
                  {uploadType === 'medicines' ? 'Upload Medicine List' : 'Upload Insulin Products'}
                </h3>
                <button
                  onClick={() => {
                    setShowUploadModal(false);
                    setSelectedFile(null);
                    setImportResult(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {!importResult ? (
                <>
                  <p className="text-gray-600 mb-4">
                    {uploadType === 'medicines' 
                      ? 'Upload a CSV file with medicine names to update the autocomplete database.'
                      : 'Upload a CSV file with insulin products (Name, ML, IU/Package, Total Units).'}
                  </p>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <p className="text-sm font-medium text-blue-800 mb-2">
                      📋 CSV Format Required:
                    </p>
                    {uploadType === 'medicines' ? (
                      <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
                        <li>Column: Medicine Name</li>
                        <li>Example: Paracetamol 500mg</li>
                      </ul>
                    ) : (
                      <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
                        <li>Columns: Medicine Name, ML, IU/Package, Total Units</li>
                        <li>Example: Actrapid 100IU, 3, 100, 300</li>
                      </ul>
                    )}
                  </div>

                  {/* File Input */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select CSV File:
                    </label>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleFileChange}
                      className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg focus:border-blue-500 cursor-pointer"
                    />
                    {selectedFile && (
                      <p className="text-sm text-green-600 mt-2">
                        ✓ Selected: {selectedFile.name}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setShowUploadModal(false);
                        setSelectedFile(null);
                        setImportResult(null);
                      }}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                    >
                      Cancel
                    </button>
                    {uploadType === 'insulin' && (
                      <button
                        onClick={handleDirectUpload}
                        disabled={!selectedFile || importingMedicines}
                        className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                        title="Simpler upload method for insulin"
                      >
                        {importingMedicines ? 'Uploading...' : 'Direct Upload'}
                      </button>
                    )}
                    <button
                      onClick={handleUploadCSV}
                      disabled={!selectedFile || importingMedicines}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      {importingMedicines ? 'Uploading...' : 'Upload'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Success/Error Result */}
                  <div className={`rounded-lg p-4 mb-6 ${importResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                    <p className={`text-sm font-medium ${importResult.success ? 'text-green-800' : 'text-red-800'} mb-2`}>
                      {importResult.success ? '✅ Upload Successful!' : '❌ Upload Failed'}
                    </p>
                    <p className={`text-sm ${importResult.success ? 'text-green-700' : 'text-red-700'}`}>
                      {importResult.message}
                    </p>
                    {importResult.total && (
                      <p className="text-sm font-semibold text-green-800 mt-2">
                        Total imported: {importResult.total}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      setShowUploadModal(false);
                      setSelectedFile(null);
                      setImportResult(null);
                    }}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    Close
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {showCleanupModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              
              <h3 className="text-xl font-semibold text-center text-gray-900 mb-2">
                Clean Production Database
              </h3>
              
              {!cleanupResult ? (
                <>
                  <p className="text-center text-gray-600 mb-4">
                    This will permanently delete all users and their data except the admin account.
                  </p>
                  
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                    <p className="text-sm font-medium text-red-800 mb-2">
                      ⚠️ DANGER: This will delete:
                    </p>
                    <ul className="text-sm text-red-700 space-y-1 list-disc list-inside">
                      <li>All user accounts (except admin)</li>
                      <li>All medications</li>
                      <li>All health records</li>
                      <li>All appointments</li>
                      <li>All adherence logs</li>
                    </ul>
                    <p className="text-sm font-semibold text-red-800 mt-3">
                      This action cannot be undone!
                    </p>
                  </div>
                  
                  {/* Password Input */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Enter confirmation password to proceed:
                    </label>
                    <input
                      type="text"
                      value={cleanupPassword}
                      onChange={(e) => setCleanupPassword(e.target.value)}
                      placeholder="Type: DELETE_ALL_DATA_2025"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      Password: <code className="bg-gray-100 px-2 py-1 rounded">DELETE_ALL_DATA_2025</code>
                    </p>
                  </div>
                  
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setShowCleanupModal(false);
                        setCleanupPassword('');
                        setCleanupResult(null);
                      }}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCleanupDatabase}
                      disabled={!cleanupPassword}
                      className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      Clean Database
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Result Display */}
                  <div className={`p-4 rounded-lg border mb-6 ${
                    cleanupResult.success
                      ? 'bg-green-50 border-green-200'
                      : 'bg-red-50 border-red-200'
                  }`}>
                    <div className="flex items-start gap-3">
                      {cleanupResult.success ? (
                        <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${
                          cleanupResult.success ? 'text-green-800' : 'text-red-800'
                        }`}>
                          {cleanupResult.success ? 'Cleanup Successful!' : 'Cleanup Failed'}
                        </p>
                        <p className={`text-sm mt-1 ${
                          cleanupResult.success ? 'text-green-700' : 'text-red-700'
                        }`}>
                          {cleanupResult.message}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {cleanupResult.success && cleanupResult.deleted && (
                    <div className="space-y-4 mb-6">
                      {/* Deleted Stats */}
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <p className="text-sm font-medium text-gray-900 mb-2">Deleted:</p>
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <div>
                            <p className="text-gray-600">Users</p>
                            <p className="text-lg font-bold text-red-600">
                              {cleanupResult.deleted.users}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-600">Medications</p>
                            <p className="text-lg font-bold text-red-600">
                              {cleanupResult.deleted.medications}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-600">Logs</p>
                            <p className="text-lg font-bold text-red-600">
                              {cleanupResult.deleted.adherence_logs}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      {/* Remaining Stats */}
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <p className="text-sm font-medium text-gray-900 mb-2">Remaining:</p>
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <div>
                            <p className="text-gray-600">Users</p>
                            <p className="text-lg font-bold text-green-600">
                              {cleanupResult.remaining.users}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-600">Medications</p>
                            <p className="text-lg font-bold text-green-600">
                              {cleanupResult.remaining.medications}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-600">Logs</p>
                            <p className="text-lg font-bold text-green-600">
                              {cleanupResult.remaining.adherence_logs}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <button
                    onClick={() => {
                      setShowCleanupModal(false);
                      setCleanupPassword('');
                      setCleanupResult(null);
                    }}
                    className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
                  >
                    Close
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Doctor Booking Modal */}
      {showDoctorBookingModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-cyan-100 rounded-full flex items-center justify-center">
                    <Stethoscope className="w-6 h-6 text-cyan-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Book Doctor Consultation</h2>
                    <p className="text-sm text-gray-600">For {selectedUser.name}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowDoctorBookingModal(false);
                    setBookingForm({ date: '', time: '', notes: '', doctorName: '', hospitalName: '', labName: '', testType: '' });
                    setAppointmentHistory([]);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Previous Booking History */}
              {loadingHistory ? (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg text-center">
                  <p className="text-sm text-gray-500">Loading history...</p>
                </div>
              ) : appointmentHistory.length > 0 && (
                <div className="mb-4 p-3 bg-cyan-50 rounded-lg border border-cyan-200">
                  <h4 className="text-sm font-semibold text-cyan-800 mb-2">Previous Consultations</h4>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {appointmentHistory.map((apt, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs bg-white p-2 rounded">
                        <div>
                          <span className="font-medium text-gray-700">{apt.doctor || 'Unknown'}</span>
                          <span className="text-gray-500 ml-2">{new Date(apt.date).toLocaleDateString()}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          apt.status === 'done' ? 'bg-green-100 text-green-700' :
                          apt.status === 'postponed' ? 'bg-orange-100 text-orange-700' :
                          apt.status === 'abandoned' ? 'bg-red-100 text-red-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {apt.status?.charAt(0).toUpperCase() + apt.status?.slice(1) || 'Upcoming'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <form onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await apiService.request('/api/appointments', {
                    method: 'POST',
                    body: JSON.stringify({
                      user_id: selectedUser.id,
                      type: 'doctor',
                      title: `Doctor Consultation - ${bookingForm.doctorName || 'General'}`,
                      doctor: bookingForm.doctorName,
                      hospital: bookingForm.hospitalName || null,
                      date: bookingForm.date,
                      time: bookingForm.time,
                      notes: bookingForm.notes,
                      status: 'upcoming'
                    })
                  });
                  toast({
                    title: 'Success',
                    description: `Doctor consultation booked for ${selectedUser.name}`,
                  });
                  setShowDoctorBookingModal(false);
                  setAppointmentHistory([]);
                  setBookingForm({ date: '', time: '', notes: '', doctorName: '', hospitalName: '', labName: '', testType: '' });
                } catch (error) {
                  toast({
                    title: 'Error',
                    description: error.message || 'Failed to book consultation',
                    variant: 'destructive',
                  });
                }
              }} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Doctor Name *</label>
                  <input
                    type="text"
                    value={bookingForm.doctorName}
                    onChange={(e) => setBookingForm(prev => ({ ...prev, doctorName: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    placeholder="Dr. Name"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hospital Name <span className="text-gray-400 font-normal">(Optional)</span></label>
                  <input
                    type="text"
                    value={bookingForm.hospitalName}
                    onChange={(e) => setBookingForm(prev => ({ ...prev, hospitalName: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    placeholder="Hospital/Clinic Name (if applicable)"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                    <input
                      type="date"
                      value={bookingForm.date}
                      onChange={(e) => setBookingForm(prev => ({ ...prev, date: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Time *</label>
                    <input
                      type="time"
                      value={bookingForm.time}
                      onChange={(e) => setBookingForm(prev => ({ ...prev, time: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
                  <textarea
                    value={bookingForm.notes}
                    onChange={(e) => setBookingForm(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    placeholder="Any special notes..."
                    rows="3"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition"
                  >
                    Book Consultation
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowDoctorBookingModal(false);
                      setBookingForm({ date: '', time: '', notes: '', doctorName: '', hospitalName: '', labName: '', testType: '' });
                      setAppointmentHistory([]);
                    }}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}


      {/* Purchase Links Modal — shared component (single source of truth, also reused by CRM) */}
      {showPurchaseLinksModal && selectedUser && (
        <PurchaseLinksPanel
          mode="modal"
          userId={selectedUser.id}
          userName={selectedUser.name}
          onClose={() => setShowPurchaseLinksModal(false)}
          onSaved={() => setShowPurchaseLinksModal(false)}
        />
      )}
      </div>
    </div>
  );
};

export default PrescriptionManagerDashboard;
