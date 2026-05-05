import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Phone, ArrowRight } from 'lucide-react';
import apiService from '../services/api';
import storageService from '../services/storageService';
import { toast } from 'sonner';

const PhoneSetupPage = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, updateUser } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      navigate('/');
      return;
    }
    setName(user.name || '');
    setPhone(user.phone || '');
  }, [user, isAuthenticated, navigate]);

  const handleContinue = async (e) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Please enter your name');
      return;
    }
    if (!phone.trim() || !/^\d{10}$/.test(phone.trim())) {
      toast.error('Please enter a valid 10-digit mobile number');
      return;
    }

    setLoading(true);
    try {
      await apiService.updateUserProfile({
        name: name.trim(),
        phone: phone.trim()
      });

      await storageService.setItem('profileCompleted', 'true');

      // Update AuthContext user object so ProtectedRoute sees updated data immediately
      updateUser({ name: name.trim(), phone: phone.trim() });

      // Update stored user data with new phone/name
      const userData = await storageService.getUserData();
      if (userData) {
        userData.name = name.trim();
        userData.phone = phone.trim();
        await storageService.setUserData(userData);
      }

      toast.success('Welcome to Careable 360+!');

      // Check for pending caregiver invite before navigating
      const pendingInvite = localStorage.getItem('pending_caregiver_invite');
      if (pendingInvite) {
        console.log('Pending caregiver invite found, navigating to /invite/' + pendingInvite);
        localStorage.removeItem('pending_caregiver_invite');
        window.location.href = `/invite/${pendingInvite}`;
      } else {
        // Use window.location.href to force full page reload
        // This ensures AuthContext.checkAuth() re-runs and reads the updated user with phone
        // which properly sets profileCompleted in storage
        window.location.href = '/home';
      }
    } catch (error) {
      console.error('Failed to save phone:', error);
      toast.error('Failed to save. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#E6F4F2] via-white to-[#EEF2F7] flex items-center justify-center p-4">
      <Card className="max-w-sm w-full p-6" data-testid="phone-setup-card">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Phone className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Almost There!</h1>
          <p className="text-gray-500 text-sm mt-1">Just your name and mobile number to get started</p>
        </div>

        <form onSubmit={handleContinue} className="space-y-4">
          <div>
            <Label htmlFor="email" className="text-xs text-gray-500">Email</Label>
            <Input
              id="email"
              value={user?.email || ''}
              disabled
              className="bg-gray-50 text-gray-600"
              data-testid="setup-email"
            />
          </div>

          <div>
            <Label htmlFor="name" className="text-xs text-gray-500">Full Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your full name"
              data-testid="setup-name"
            />
          </div>

          <div>
            <Label htmlFor="phone" className="text-xs text-gray-500">Mobile Number *</Label>
            <Input
              id="phone"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="10-digit mobile number"
              maxLength={10}
              type="tel"
              data-testid="setup-phone"
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-5"
            data-testid="setup-continue-btn"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                Continue
                <ArrowRight className="w-4 h-4" />
              </span>
            )}
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default PhoneSetupPage;
