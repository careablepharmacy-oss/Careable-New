import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { UserCheck, AlertCircle, Loader2 } from 'lucide-react';
import apiService from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';

const CaregiverAcceptPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, user, loading: authLoading } = useAuth();
  const [inviteData, setInviteData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState(null);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    fetchInviteDetails();
  }, [token]);

  const fetchInviteDetails = async () => {
    try {
      const data = await apiService.get(`/api/caregiver/invite/${token}`);
      setInviteData(data);
    } catch (err) {
      setError(err.message || 'This invite link is invalid or expired');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!isAuthenticated) {
      // Store the invite token so we can accept after login
      localStorage.setItem('pending_caregiver_invite', token);
      toast('Please sign in to accept the invitation');
      navigate('/');
      return;
    }

    setAccepting(true);
    try {
      const result = await apiService.post(`/api/caregiver/accept/${token}`);
      setAccepted(true);
      toast.success(`You are now linked as caregiver for ${result.patient_name}`);

      // Initialize OneSignal web push for the caregiver (dynamic import, web only)
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (!Capacitor.isNativePlatform() && user) {
          const userId = user.id || user._id;
          if (userId) {
            const { default: svc } = await import('../services/oneSignalWebService');
            svc.initAndLogin(userId).catch(() => {});
          }
        }
      } catch (_) {}
    } catch (err) {
      toast.error(err.message || 'Failed to accept invitation');
    } finally {
      setAccepting(false);
    }
  };

  // Auto-accept if user came back from login with a pending invite
  useEffect(() => {
    if (isAuthenticated && !authLoading && inviteData && !accepted && !error) {
      const pendingToken = localStorage.getItem('pending_caregiver_invite');
      if (pendingToken === token) {
        localStorage.removeItem('pending_caregiver_invite');
        handleAccept();
      }
    }
  }, [isAuthenticated, authLoading, inviteData]);

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-sm w-full p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-gray-900 mb-2">Invalid Invitation</h2>
          <p className="text-gray-600 text-sm mb-4">{error}</p>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => navigate('/')}
            data-testid="go-home-btn"
          >
            Go to Home
          </Button>
        </Card>
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-sm w-full p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <UserCheck className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">You're Connected!</h2>
          <p className="text-gray-600 text-sm mb-4">
            You are now linked as a caregiver for <strong>{inviteData?.patient_name}</strong>.
            You will receive notifications about their medication status.
          </p>
          <Button
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => navigate('/caregiver-dashboard')}
            data-testid="go-dashboard-btn"
          >
            Go to Caregiver Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="max-w-sm w-full p-6 text-center" data-testid="invite-accept-card">
        {inviteData?.patient_picture ? (
          <img
            src={inviteData.patient_picture}
            alt={inviteData.patient_name}
            className="w-20 h-20 rounded-full mx-auto mb-4 border-4 border-emerald-100"
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <UserCheck className="w-10 h-10 text-emerald-600" />
          </div>
        )}

        <h2 className="text-lg font-bold text-gray-900 mb-1">Caregiver Invitation</h2>
        <p className="text-gray-600 text-sm mb-6">
          <strong>{inviteData?.patient_name}</strong> has invited you to be their health caregiver on Careable 360+.
          You'll be able to view their medication schedule and receive notifications.
        </p>

        <Button
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-5 text-base"
          onClick={handleAccept}
          disabled={accepting}
          data-testid="accept-invite-btn"
        >
          {accepting ? (
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
          ) : (
            <UserCheck className="w-5 h-5 mr-2" />
          )}
          {isAuthenticated ? 'Accept Invitation' : 'Sign In & Accept'}
        </Button>
      </Card>
    </div>
  );
};

export default CaregiverAcceptPage;
