import './App.css';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Toaster } from './components/ui/sonner';
import { Toaster as ShadcnToaster } from './components/ui/toaster';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LandingPage from './pages/LandingPage';
import HomePage from './pages/HomePage';
import MedicationsPage from './pages/MedicationsPage';
import AddMedicationPage from './pages/AddMedicationPage';
import ReportsPage from './pages/ReportsPage';
import ChatPage from './pages/ChatPage';
import HealthHistoryPage from './pages/HealthHistoryPage';
import ProfilePage from './pages/ProfilePage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import ProfileCreationPage from './pages/ProfileCreationPage';
import PhoneSetupPage from './pages/PhoneSetupPage';
import BookingPage from './pages/BookingPage';
import PrescriptionManagerDashboard from './pages/PrescriptionManagerDashboard';
import AdminDashboard from './pages/AdminDashboard';
import DeveloperTestingPanel from './pages/DeveloperTestingPanel';
import AboutPage from './pages/AboutPage';
// E-commerce pages
import MedicalEquipmentPage from './pages/MedicalEquipmentPage';
import PersonalCarePage from './pages/PersonalCarePage';
import CartPage from './pages/CartPage';
import ProductManagementPage from './pages/ProductManagementPage';
import CheckoutPage from './pages/CheckoutPage';
import OrderConfirmationPage from './pages/OrderConfirmationPage';
import OrdersPage from './pages/OrdersPage';
import CaregiverInvitePage from './pages/CaregiverInvitePage';
import CaregiverAcceptPage from './pages/CaregiverAcceptPage';
import CaregiverDashboardPage from './pages/CaregiverDashboardPage';
// Invoice Manager pages
import InvoiceLayout from './components/InvoiceLayout';
import InvDashboard from './pages/invoice/InvDashboard';
import InvInvoiceList from './pages/invoice/InvInvoiceList';
import InvInvoiceCreator from './pages/invoice/InvInvoiceCreator';
import InvInvoiceView from './pages/invoice/InvInvoiceView';
import InvSimpleInvoiceView from './pages/invoice/InvSimpleInvoiceView';
import InvCODMonitor from './pages/invoice/InvCODMonitor';
import InvOnlineMonitor from './pages/invoice/InvOnlineMonitor';
import InvOrderManagement from './pages/invoice/InvOrderManagement';
import InvCoupons from './pages/invoice/InvCoupons';
import InvSellerSettings from './pages/invoice/InvSellerSettings';
// CRM pages
import CrmLayout from './components/crm/CrmLayout';
import CrmDashboard from './pages/crm/CrmDashboard';
import CrmPatients from './pages/crm/CrmPatients';
import CrmPatientDetail from './pages/crm/CrmPatientDetail';
import CrmPatientOnboarding from './pages/crm/CrmPatientOnboarding';
import CrmOpportunities from './pages/crm/CrmOpportunities';
import CrmLabTests from './pages/crm/CrmLabTests';
import CrmLabReconciliation from './pages/crm/CrmLabReconciliation';
import React, { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import notificationManager from './services/notificationManager';
import storageService from './services/storageService';

// Error Boundary to prevent uncaught rendering errors from crashing the WebView
class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[AppErrorBoundary] Caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, textAlign: 'center' }}>
          <h2>Something went wrong</h2>
          <p style={{ color: '#666', marginTop: 8 }}>Please restart the app</p>
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: 16, padding: '8px 24px', borderRadius: 8, border: '1px solid #ccc', background: '#fff' }}
          >
            Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}


// Version Check and Service Worker Management
const VERSION_URL = '/version.json';
const VERSION_STORAGE_KEY = 'app_version';

async function checkAndUpdateVersion() {
  try {
    // Fetch current version from server
    const response = await fetch(VERSION_URL, { cache: 'no-store' });
    const versionData = await response.json();
    const newVersion = versionData.version;
    
    // Get stored version
    const storedVersion = localStorage.getItem(VERSION_STORAGE_KEY);
    
    console.log('[Version Check] Stored version:', storedVersion);
    console.log('[Version Check] New version:', newVersion);
    
    // If version changed OR first run (no stored version)
    if (!storedVersion || storedVersion !== newVersion) {
      console.log('[Version Check] Version changed or first run! Clearing caches and reloading...');
      
      // Unregister all service workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
          console.log('[Version Check] Unregistered service worker');
        }
      }
      
      // Clear all caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        for (const cacheName of cacheNames) {
          await caches.delete(cacheName);
          console.log('[Version Check] Deleted cache:', cacheName);
        }
      }
      
      // Clear localStorage except essential data
      const authToken = localStorage.getItem('auth_token');
      const userData = localStorage.getItem('user_data');
      localStorage.clear();
      if (authToken) localStorage.setItem('auth_token', authToken);
      if (userData) localStorage.setItem('user_data', userData);
      
      // Store new version
      localStorage.setItem(VERSION_STORAGE_KEY, newVersion);
      
      // Show alert and reload
      alert(`App updated to version ${newVersion}! The app will now reload.`);
      window.location.reload(true);
      
      return true; // Version changed
    }
    
    // Store version if first time
    if (!storedVersion) {
      localStorage.setItem(VERSION_STORAGE_KEY, newVersion);
      console.log('[Version Check] First run, stored version:', newVersion);
    }
    
    return false; // No version change
  } catch (error) {
    console.error('[Version Check] Failed:', error);
    return false;
  }
}


// Root Route Handler - redirects authenticated users
const RootRoute = () => {
  const { isAuthenticated, user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  useEffect(() => {
    // Wait for auth to finish loading
    if (loading) {
      console.log('[RootRoute] Auth loading...');
      return;
    }
    
    // Check if this is an OAuth callback (has session_id in URL or storage)
    const isOAuthCallback = location.hash.includes('session_id') || 
                           sessionStorage.getItem('deepLinkUrl');
    
    if (isOAuthCallback) {
      console.log('[RootRoute] OAuth callback detected, staying on landing page');
      return;
    }
    
    // If authenticated, redirect to appropriate page
    if (isAuthenticated && user) {
      console.log('[RootRoute] User authenticated, redirecting...');
      if (user.role === 'prescription_manager') {
        navigate('/prescription-manager', { replace: true });
      } else {
        navigate('/home', { replace: true });
      }
    } else {
      console.log('[RootRoute] Not authenticated, showing landing page');
    }
  }, [isAuthenticated, user, loading, navigate, location]);
  
  // Show landing page
  return <LandingPage />;
};

// Protected Route Component
const ProtectedRoute = ({ children, requireProfile = true }) => {
  const { isAuthenticated, loading } = useAuth();
  const [profileCompleted, setProfileCompleted] = React.useState(null);
  const location = useLocation();
  
  useEffect(() => {
    const checkProfile = async () => {
      const completed = await storageService.getItem('profileCompleted');
      console.log('[ProtectedRoute] Profile completed flag:', completed);
      setProfileCompleted(completed === 'true');
    };
    checkProfile();
  }, [location.pathname]); // Re-check whenever route changes
  
  if (loading || profileCompleted === null) {
    console.log('[ProtectedRoute] Loading or checking profile...');
    return <div>Loading...</div>;
  }
  
  if (!isAuthenticated) {
    console.log('[ProtectedRoute] Not authenticated, redirecting to login');
    return <Navigate to="/" replace />;
  }
  
  // Check if profile is required and completed
  if (requireProfile && !profileCompleted) {
    console.log('[ProtectedRoute] Profile not completed, redirecting to phone-setup');
    return <Navigate to="/phone-setup" replace />;
  }
  
  console.log('[ProtectedRoute] Access granted to:', location.pathname);
  return children;
};

function App() {
  useEffect(() => {
    // Check version on app startup (FIRST PRIORITY)
    const init = async () => {
      // Check and update version first
      const versionChanged = await checkAndUpdateVersion();
      if (versionChanged) {
        // App will reload, don't continue initialization
        return;
      }
      
      // Initialize notifications after version check
      await initNotifications();
    };
    
    // Initialize notifications on app startup
    const initNotifications = async () => {
      try {
        console.log('[App.js] Initializing notification system...');
        const granted = await notificationManager.initialize();
        if (granted) {
          console.log('[App.js] Notification permissions granted');
        } else {
          console.log('[App.js] Notification permissions denied or not available');
        }
        
        // Sync alarm setting from backend to localStorage (for notificationManager)
        if (Capacitor.isNativePlatform()) {
          try {
            const apiService = (await import('./services/api')).default;
            const settings = await apiService.getNotificationSettings();
            const alarmEnabled = settings.alarm_enabled === true;
            await storageService.setItem('local_alarms_enabled', alarmEnabled.toString());
            console.log('[App.js] Synced alarm_enabled from backend:', alarmEnabled);
          } catch (syncErr) {
            console.warn('[App.js] Failed to sync alarm setting from backend:', syncErr);
          }
        }
      } catch (error) {
        console.error('[App.js] Error initializing notifications:', error);
      }
    };
    
    init();
    
    // Handle deep links globally at app level
    if (Capacitor.isNativePlatform()) {
      const handleAppUrlOpen = CapApp.addListener('appUrlOpen', (event) => {
        console.log('[App.js] Deep link received:', event.url);
        
        // Store the deep link URL for LandingPage to process
        if (event.url && event.url.includes('session_id=')) {
          console.log('[App.js] Storing deep link URL');
          sessionStorage.setItem('deepLinkUrl', event.url);
          
          // Force navigation to root to trigger LandingPage
          window.location.href = '/';
        }
      });

      return () => {
        handleAppUrlOpen.remove();
      };
    }
  }, []);

  return (
    <div className="App">
      <AppErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
          <Route path="/" element={<RootRoute />} />
          <Route path="/lander" element={<LandingPage />} />
          <Route path="/profile-setup" element={<ProtectedRoute requireProfile={false}><ProfileCreationPage /></ProtectedRoute>} />
          <Route path="/phone-setup" element={<ProtectedRoute requireProfile={false}><PhoneSetupPage /></ProtectedRoute>} />
          <Route path="/booking" element={<ProtectedRoute><BookingPage /></ProtectedRoute>} />
          <Route 
            path="/home" 
            element={
              <ProtectedRoute>
                <HomePage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/medications" 
            element={
              <ProtectedRoute>
                <MedicationsPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/medications/add" 
            element={
              <ProtectedRoute>
                <AddMedicationPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/medications/edit/:id" 
            element={
              <ProtectedRoute>
                <AddMedicationPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/reports" 
            element={
              <ProtectedRoute>
                <ReportsPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/reports/history/:type" 
            element={
              <ProtectedRoute>
                <HealthHistoryPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/chat" 
            element={
              <ProtectedRoute>
                <ChatPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/profile" 
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/privacy-policy" 
            element={
              <ProtectedRoute>
                <PrivacyPolicyPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/about" 
            element={
              <ProtectedRoute>
                <AboutPage />
              </ProtectedRoute>
            } 
          />

          {/* Prescription Manager Dashboard */}
          <Route 
            path="/prescription-manager" 
            element={
              <ProtectedRoute requireProfile={false}>
                <PrescriptionManagerDashboard />
              </ProtectedRoute>
            } 
          />
          
          {/* Admin Dashboard */}
          <Route 
            path="/admin-dashboard" 
            element={
              <ProtectedRoute requireProfile={false}>
                <AdminDashboard />
              </ProtectedRoute>
            } 
          />
          
          {/* E-commerce Routes */}
          <Route 
            path="/medical-equipment" 
            element={
              <ProtectedRoute>
                <MedicalEquipmentPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/personal-care" 
            element={
              <ProtectedRoute>
                <PersonalCarePage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/cart" 
            element={
              <ProtectedRoute>
                <CartPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/product-management" 
            element={
              <ProtectedRoute requireProfile={false}>
                <ProductManagementPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/checkout" 
            element={
              <ProtectedRoute>
                <CheckoutPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/order-confirmation/:orderId" 
            element={
              <ProtectedRoute>
                <OrderConfirmationPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/orders" 
            element={
              <ProtectedRoute>
                <OrdersPage />
              </ProtectedRoute>
            } 
          />
          
          <Route path="/dev-testing" element={
            <ProtectedRoute>
              <DeveloperTestingPanel />
            </ProtectedRoute>
          } />
          {/* Reminder routes placeholders */}
          <Route path="/reminders/:type" element={<ProtectedRoute><div className="p-6">Coming Soon</div></ProtectedRoute>} />
          <Route path="/terms" element={<ProtectedRoute><div className="p-6">Terms of Service - Coming Soon</div></ProtectedRoute>} />
          <Route path="/faq" element={<ProtectedRoute><div className="p-6">FAQ - Coming Soon</div></ProtectedRoute>} />
          {/* Redirect old routes */}
          <Route path="/dashboard" element={<Navigate to="/home" replace />} />
          <Route path="/schedule" element={<Navigate to="/home" replace />} />

          {/* Caregiver Routes */}
          <Route path="/caregiver-invite" element={<ProtectedRoute><CaregiverInvitePage /></ProtectedRoute>} />
          <Route path="/invite/:token" element={<CaregiverAcceptPage />} />
          <Route path="/caregiver-dashboard" element={<ProtectedRoute><CaregiverDashboardPage /></ProtectedRoute>} />

          {/* Invoice Manager Routes */}
          <Route path="/invoice-manager" element={<ProtectedRoute requireProfile={false}><InvoiceLayout /></ProtectedRoute>}>
            <Route index element={<InvDashboard />} />
            <Route path="invoices" element={<InvInvoiceList />} />
            <Route path="invoices/create" element={<InvInvoiceCreator />} />
            <Route path="invoices/:invoiceId" element={<InvInvoiceView />} />
            <Route path="cod-monitor" element={<InvCODMonitor />} />
            <Route path="online-monitor" element={<InvOnlineMonitor />} />
            <Route path="orders" element={<InvOrderManagement />} />
            <Route path="coupons" element={<InvCoupons />} />
            <Route path="settings" element={<InvSellerSettings />} />
          </Route>
          {/* Public Invoice View (no auth required) */}
          <Route path="/invoice/:invoiceId/:token" element={<InvSimpleInvoiceView isPublicView={true} />} />

          {/* CRM Routes (Prescription Manager / Admin only) */}
          <Route
            path="/crm"
            element={
              <ProtectedRoute requireProfile={false}>
                <CrmLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<CrmDashboard />} />
            <Route path="patients" element={<CrmPatients />} />
            <Route path="patients/:id" element={<CrmPatientDetail />} />
            <Route path="patients/:id/onboarding" element={<CrmPatientOnboarding />} />
            <Route path="opportunities" element={<CrmOpportunities />} />
            <Route path="lab-tests" element={<CrmLabTests />} />
            <Route path="lab-reconciliation" element={<CrmLabReconciliation />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster />
      <ShadcnToaster />
      </AuthProvider>
      </AppErrorBoundary>
    </div>
  );
}

export default App;
