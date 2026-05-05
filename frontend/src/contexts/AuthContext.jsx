import React, { createContext, useContext, useState, useEffect } from 'react';
import apiService from '../services/api';
import storageService from '../services/storageService';
import { Capacitor } from '@capacitor/core';

console.log('[AuthContext] storageService imported:', typeof storageService, storageService);

/**
 * Initialize OneSignal in background - FIRE AND FORGET
 * This is completely non-blocking and does NOT affect login/session
 * Silent login works independently of push status
 */
const initializePushBackground = () => {
  console.log('[AuthContext] initializePushBackground called, isNative:', Capacitor.isNativePlatform());
  
  if (!Capacitor.isNativePlatform()) {
    console.log('[AuthContext] Skipping push init - not native platform');
    return;
  }

  // Fire and forget - do NOT await this
  (async () => {
    try {
      console.log('[AuthContext] Starting background OneSignal initialization...');
      const oneSignalService = (await import('../services/oneSignalService')).default;
      
      // Initialize OneSignal (non-blocking internally)
      await oneSignalService.initialize();
      
      console.log('[AuthContext] ✅ OneSignal background init complete');
    } catch (error) {
      // Push failure is non-critical - log and continue
      console.log('[AuthContext] ⚠️ OneSignal init skipped:', error.message);
    }
  })();
};

/**
 * Associate user with OneSignal after login
 */
const associateUserWithPush = async (userId, email) => {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  try {
    console.log('[AuthContext] Associating user with OneSignal:', userId);
    const oneSignalService = (await import('../services/oneSignalService')).default;
    await oneSignalService.login(userId, email);
    console.log('[AuthContext] ✅ User associated with OneSignal');
  } catch (error) {
    console.log('[AuthContext] ⚠️ OneSignal user association skipped:', error.message);
  }
};

/**
 * Disassociate user from OneSignal on logout
 */
const disassociateUserFromPush = async () => {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  try {
    const oneSignalService = (await import('../services/oneSignalService')).default;
    await oneSignalService.logout();
    console.log('[AuthContext] ✅ User disassociated from OneSignal');
  } catch (error) {
    console.log('[AuthContext] ⚠️ OneSignal logout skipped:', error.message);
  }
};

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pushStatus, setPushStatus] = useState('pending');

  useEffect(() => {
    // Initialize OneSignal early (non-blocking)
    initializePushBackground();
    
    // Check authentication
    checkAuth();
  }, []);

  /**
   * Check authentication - Silent login implementation
   * This works INDEPENDENTLY of push status
   */
  const checkAuth = async () => {
    console.log('[AuthContext] ========================================');
    console.log('[AuthContext] CHECKING AUTHENTICATION (Silent Login)');
    console.log('[AuthContext] ========================================');
    
    try {
      // Step 1: Check if session token exists in storage
      const sessionToken = await storageService.getSessionToken();
      const authFlag = await storageService.getAuthenticated();
      
      console.log('[AuthContext] Session token exists:', !!sessionToken);
      console.log('[AuthContext] Auth flag:', authFlag);
      
      if (sessionToken && authFlag === 'true') {
        console.log('[AuthContext] Valid session found, attempting silent login...');
        
        try {
          // Step 2: Validate token with backend
          const userData = await apiService.getCurrentUser();
          
          console.log('[AuthContext] ✅ SILENT LOGIN SUCCESSFUL:', userData.email);
          setUser(userData);
          setIsAuthenticated(true);
          
          // Update stored user data
          await storageService.setUserData(userData);
          
          // Check if profile is complete (only name and phone are required)
          const isProfileComplete = userData.name && userData.phone;
          if (isProfileComplete) {
            await storageService.setItem('profileCompleted', 'true');
            console.log('[AuthContext] Profile is complete');
          } else {
            console.log('[AuthContext] Profile incomplete');
          }
          
          // Load saved push status
          const savedPushStatus = await storageService.getItem('pushStatus');
          if (savedPushStatus) {
            setPushStatus(savedPushStatus);
          }
          
          // Associate user with OneSignal (fire and forget)
          associateUserWithPush(userData._id || userData.id, userData.email);
          
        } catch (error) {
          console.error('[AuthContext] ❌ Token validation failed:', error);
          
          // Token is invalid or expired, clear storage
          await clearAuthData();
        }
      } else {
        console.log('[AuthContext] No valid session found, user needs to login');
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('[AuthContext] Error checking auth:', error);
      setIsAuthenticated(false);
    }
    
    setLoading(false);
    console.log('[AuthContext] Auth check complete, loading:', false);
  };

  /**
   * Login with session ID (from Google OAuth)
   * Push registration is non-blocking
   */
  const login = async (sessionId) => {
    try {
      console.log('[AuthContext] ========================================');
      console.log('[AuthContext] LOGIN STARTED');
      console.log('[AuthContext] ========================================');
      
      const response = await apiService.createSession(sessionId);
      
      // Store session token securely
      if (response.session_token) {
        console.log('[AuthContext] Storing session token...');
        await storageService.setSessionToken(response.session_token);
      }
      
      // Store user data and auth flag
      await storageService.setUserData(response.user);
      await storageService.setAuthenticated('true');
      
      // Check if profile is complete (only name and phone are required)
      const isProfileComplete = response.user.name && response.user.phone;
      if (isProfileComplete) {
        await storageService.setItem('profileCompleted', 'true');
        console.log('[AuthContext] Profile is complete');
      } else {
        console.log('[AuthContext] Profile incomplete, will redirect to profile setup');
      }
      
      // Update state IMMEDIATELY - don't wait for push
      setUser(response.user);
      setIsAuthenticated(true);
      
      console.log('[AuthContext] ✅ LOGIN SUCCESSFUL:', response.user.email);
      
      // Associate user with OneSignal (fire and forget)
      associateUserWithPush(
        response.user._id || response.user.id, 
        response.user.email
      );
      
      return response.user;
    } catch (error) {
      console.error('[AuthContext] ❌ Login failed:', error);
      throw error;
    }
  };

  /**
   * JWT email/password login or registration.
   * Calls /api/auth/jwt-login or /api/auth/jwt-register depending on mode.
   */
  const loginWithJWT = async ({ mode, email, password, name }) => {
    const axios = (await import('axios')).default;
    const backendUrl = process.env.REACT_APP_BACKEND_URL;
    const endpoint =
      mode === 'register' ? '/api/auth/jwt-register' : '/api/auth/jwt-login';
    const body =
      mode === 'register' ? { email, password, name } : { email, password };

    const { data } = await axios.post(`${backendUrl}${endpoint}`, body, {
      withCredentials: true,
    });

    // Store both: bearer token (for native app) AND rely on cookie (for web)
    if (data.access_token) {
      await storageService.setSessionToken(data.access_token);
    }
    await storageService.setUserData(data.user);
    await storageService.setAuthenticated('true');

    const isProfileComplete = data.user?.name && data.user?.phone;
    if (isProfileComplete) {
      await storageService.setItem('profileCompleted', 'true');
    }

    setUser(data.user);
    setIsAuthenticated(true);

    associateUserWithPush(data.user.id, data.user.email);

    return data.user;
  };

  /**
   * Logout - clears all auth data including push association
   */
  const logout = async () => {
    console.log('[AuthContext] Logging out...');
    try {
      // Disassociate from OneSignal first
      await disassociateUserFromPush();
      
      await apiService.logout();
    } catch (error) {
      console.error('[AuthContext] Logout API failed:', error);
    } finally {
      // Always clear local state and storage
      await clearAuthData();
      console.log('[AuthContext] ✅ Logout complete');
    }
  };

  /**
   * Clear all authentication data
   */
  const clearAuthData = async () => {
    setUser(null);
    setIsAuthenticated(false);
    setPushStatus('pending');
    
    await storageService.removeAuthenticated();
    await storageService.removeSessionToken();
    await storageService.removeUserData();
    await storageService.removeItem('profileCompleted');
    await storageService.removeItem('pushStatus');
    await storageService.removeItem('onesignal_user_id');
  };

  /**
   * Update user data
   */
  const updateUser = (userData) => {
    setUser({ ...user, ...userData });
  };

  /**
   * Refresh user data from backend
   */
  const refreshUser = async () => {
    try {
      const userData = await apiService.getCurrentUser();
      setUser(userData);
      await storageService.setUserData(userData);
      return userData;
    } catch (error) {
      console.error('[AuthContext] Failed to refresh user:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      isAuthenticated, 
      pushStatus,
      login,
      loginWithJWT,
      logout, 
      updateUser, 
      refreshUser,
      checkAuth 
    }}>
      {children}
    </AuthContext.Provider>
  );
};
