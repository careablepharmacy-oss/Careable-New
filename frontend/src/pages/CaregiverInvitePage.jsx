import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  ChevronLeft,
  UserPlus,
  Send,
  Link2,
  UserCheck,
  Unlink,
  Loader2
} from 'lucide-react';
import BottomNav from '../components/BottomNav';
import apiService from '../services/api';
import { toast } from 'sonner';

const CaregiverInvitePage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [phone, setPhone] = useState(searchParams.get('phone') || '');
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [caregiverInfo, setCaregiverInfo] = useState(null);
  const [unlinking, setUnlinking] = useState(false);

  useEffect(() => {
    loadCaregiverStatus();
  }, []);

  const loadCaregiverStatus = async () => {
    try {
      const data = await apiService.get('/api/caregiver/my-caregiver');
      setCaregiverInfo(data);
    } catch (err) {
      console.error('Failed to load caregiver status:', err);
    } finally {
      setPageLoading(false);
    }
  };

  const handleInvite = async () => {
    const cleanPhone = phone.replace(/\s/g, '');
    if (!/^\d{10}$/.test(cleanPhone)) {
      toast.error('Please enter a valid 10-digit phone number');
      return;
    }

    setLoading(true);
    try {
      const data = await apiService.post('/api/caregiver/invite', {
        caregiver_phone: cleanPhone
      });

      // Open WhatsApp with pre-filled message to caregiver's number
      window.open(data.whatsapp_url, '_blank');

      toast.success('Opening WhatsApp to send the invitation');
      setCaregiverInfo({
        linked: false,
        invite_status: 'pending',
        caregiver_phone: cleanPhone,
      });
      setPhone('');
    } catch (err) {
      toast.error(err.message || 'Failed to create invitation');
    } finally {
      setLoading(false);
    }
  };

  const handleUnlink = async () => {
    setUnlinking(true);
    try {
      await apiService.request('/api/caregiver/unlink', { method: 'DELETE' });
      toast.success('Caregiver unlinked successfully');
      setCaregiverInfo(null);
    } catch (err) {
      toast.error(err.message || 'Failed to unlink caregiver');
    } finally {
      setUnlinking(false);
    }
  };

  if (pageLoading) {
    return (
      <div className="pb-20 bg-gray-50 min-h-screen">
        <div className="bg-white p-4 border-b">
          <div className="h-6 bg-gray-200 rounded w-40 animate-pulse" />
        </div>
        <div className="p-4">
          <Card className="p-6 animate-pulse">
            <div className="h-16 bg-gray-200 rounded mb-4" />
            <div className="h-10 bg-gray-200 rounded" />
          </Card>
        </div>
      </div>
    );
  }

  const isLinked = caregiverInfo?.linked;
  const isPending = caregiverInfo?.invite_status === 'pending';

  return (
    <div className="pb-20 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-white p-4 border-b sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/home')}
            className="p-2"
            data-testid="back-btn"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold text-gray-900">Caregiver</h1>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-lg mx-auto">
        {/* Current Status */}
        {isLinked && (
          <Card className="p-5" data-testid="caregiver-linked-card">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                <UserCheck className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">{caregiverInfo.caregiver_name}</p>
                <p className="text-sm text-gray-500">{caregiverInfo.caregiver_email}</p>
              </div>
            </div>
            <div className="bg-[#2BA89F]/10 rounded-lg p-3 mb-4">
              <p className="text-sm text-emerald-700 font-medium">Caregiver is connected and receiving notifications</p>
            </div>
            <Button
              variant="outline"
              className="w-full text-red-600 border-red-200 hover:bg-red-50"
              onClick={handleUnlink}
              disabled={unlinking}
              data-testid="unlink-btn"
            >
              {unlinking ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Unlink className="w-4 h-4 mr-2" />}
              Unlink Caregiver
            </Button>
          </Card>
        )}

        {isPending && !isLinked && (
          <Card className="p-5" data-testid="caregiver-pending-card">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                <Link2 className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">Invite Pending</p>
                <p className="text-sm text-gray-500">Sent to {caregiverInfo.caregiver_phone}</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Waiting for your caregiver to open the link and accept the invitation.
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                onClick={handleUnlink}
                disabled={unlinking}
                data-testid="cancel-invite-btn"
              >
                Cancel Invite
              </Button>
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => setPhone(caregiverInfo.caregiver_phone || '')}
                data-testid="resend-invite-btn"
              >
                Resend
              </Button>
            </div>
          </Card>
        )}

        {/* Invite Form — show when no active link or pending invite */}
        {!isLinked && !isPending && (
          <Card className="p-5" data-testid="invite-form-card">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <UserPlus className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="font-bold text-gray-900">Invite a Caregiver</h2>
                <p className="text-sm text-gray-500">They'll receive updates about your medicines</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <Label htmlFor="cg-phone" className="text-sm text-gray-600">Caregiver's Phone Number</Label>
                <Input
                  id="cg-phone"
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={phone}
                  onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
                  placeholder="10-digit mobile number"
                  data-testid="caregiver-phone-input"
                />
              </div>

              <Button
                className="w-full bg-[#25D366] hover:bg-[#1fb855] text-white"
                onClick={handleInvite}
                disabled={loading || phone.length !== 10}
                data-testid="send-invite-btn"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Send Invite via WhatsApp
              </Button>
            </div>
          </Card>
        )}

        {/* Info */}
        <Card className="p-4 bg-blue-50 border-blue-100">
          <h3 className="font-medium text-blue-900 text-sm mb-2">How it works</h3>
          <ul className="text-sm text-blue-800 space-y-1.5">
            <li>1. Enter your caregiver's phone number</li>
            <li>2. A WhatsApp message with an invite link is prepared for you to send</li>
            <li>3. Your caregiver opens the link and signs in</li>
            <li>4. They can then view your medication schedule and receive notifications</li>
          </ul>
        </Card>
      </div>

      <BottomNav active="home" />
    </div>
  );
};

export default CaregiverInvitePage;
