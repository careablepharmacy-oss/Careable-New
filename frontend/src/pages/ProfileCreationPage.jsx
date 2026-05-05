import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { User, Mail, Phone, MapPin } from 'lucide-react';
import { toast } from '../hooks/use-toast';
import apiService from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import storageService from '../services/storageService';

const ProfileCreationPage = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, updateUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    sex: '',
    age: '',
    whatsapp: '',
    address: '',
    city: '',
    state: '',
    country: 'India',
    pincode: '',
    relativeName: '',
    relativeEmail: '',
    relativeWhatsapp: ''
  });

  useEffect(() => {
    // Check if user is authenticated
    if (!isAuthenticated && !user) {
      toast({
        title: 'Please log in',
        description: 'You need to log in first to create your profile.',
        variant: 'destructive'
      });
      navigate('/');
      return;
    }
    
    // Pre-fill all fields from authenticated user data and API
    const loadUserData = async () => {
      try {
        const freshUser = await apiService.get('/api/auth/me');
        const source = freshUser || user;
        if (source) {
          setFormData(prev => ({
            ...prev,
            email: source.email || user?.email || '',
            name: source.name || user?.name || '',
            sex: source.sex || '',
            age: source.age ? String(source.age) : '',
            whatsapp: source.phone || '',
            address: source.address || '',
            city: source.city || '',
            state: source.state || '',
            country: source.country || 'India',
            pincode: source.pincode || '',
            relativeName: source.relative_name || '',
            relativeEmail: source.relative_email || '',
            relativeWhatsapp: source.relative_whatsapp || ''
          }));
        }
      } catch {
        // Fallback to AuthContext user
        if (user) {
          setFormData(prev => ({
            ...prev,
            email: user.email || '',
            name: user.name || '',
            whatsapp: user.phone || ''
          }));
        }
      }
    };
    loadUserData();
  }, [user, isAuthenticated, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Check authentication before submitting
    if (!isAuthenticated) {
      toast({
        title: 'Authentication Required',
        description: 'Please log in first to complete your profile.',
        variant: 'destructive'
      });
      navigate('/');
      return;
    }
    
    setLoading(true);
    
    try {
      console.log('Submitting profile data:', formData);
      
      // Save complete profile to backend
      const updatedUser = await apiService.updateUserProfile({
        name: formData.name,
        phone: formData.whatsapp,
        sex: formData.sex,
        age: formData.age ? parseInt(formData.age) : null,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        country: formData.country,
        pincode: formData.pincode,
        relative_name: formData.relativeName,
        relative_email: formData.relativeEmail,
        relative_whatsapp: formData.relativeWhatsapp
      });
      
      console.log('Profile updated successfully:', updatedUser);
      
      // Use storageService instead of localStorage for native compatibility
      await storageService.setItem('profileCompleted', 'true');
      
      updateUser(updatedUser);
      
      toast({
        title: 'Success!',
        description: 'Profile created successfully',
      });
      
      console.log('Profile completion flag set, redirecting to home...');
      
      // Force navigation using window.location to avoid React Router conflicts
      setTimeout(() => {
        window.location.href = '/home';
      }, 500);
      
    } catch (error) {
      console.error('Profile creation failed:', error);
      
      // Check if it's an authentication error
      if (error.message === 'Unauthorized') {
        toast({
          title: 'Session Expired',
          description: 'Please log in again.',
          variant: 'destructive'
        });
        navigate('/');
      } else {
        toast({
          title: 'Error',
          description: error.message || 'Failed to create profile. Please try again.',
          variant: 'destructive'
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#E6F4F2] via-white to-[#EEF2F7] p-4 flex items-center justify-center">
      <Card className="max-w-md w-full p-6">
        <div className="text-center mb-6">
          <div className="w-20 h-20 bg-gradient-to-br from-[#2BA89F] via-[#7AB648] to-[#1E3A5F] rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Complete Your Profile</h1>
          <p className="text-gray-600 text-sm mt-2">Help us personalize your experience</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div>
            <Label htmlFor="email">Email ID *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              disabled
              className="bg-gray-100"
              required
            />
            <p className="text-xs text-gray-500 mt-1">Email from your Google account</p>
          </div>

          <div>
            <Label htmlFor="whatsapp">Mobile Number *</Label>
            <Input
              id="whatsapp"
              type="text"
              inputMode="numeric"
              value={formData.whatsapp}
              onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
              placeholder="+91 98765 43210"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="sex">Sex</Label>
              <Select value={formData.sex} onValueChange={(value) => setFormData({ ...formData, sex: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="age">Age</Label>
              <Input
                id="age"
                type="number"
                min="1"
                max="120"
                value={formData.age}
                onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                placeholder="25"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="House No., Street, Area"
            />
          </div>

          <div>
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              placeholder="City"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="state">State</Label>
              <Select value={formData.state} onValueChange={(value) => setFormData({ ...formData, state: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select State" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Andhra Pradesh">Andhra Pradesh</SelectItem>
                  <SelectItem value="Arunachal Pradesh">Arunachal Pradesh</SelectItem>
                  <SelectItem value="Assam">Assam</SelectItem>
                  <SelectItem value="Bihar">Bihar</SelectItem>
                  <SelectItem value="Chhattisgarh">Chhattisgarh</SelectItem>
                  <SelectItem value="Goa">Goa</SelectItem>
                  <SelectItem value="Gujarat">Gujarat</SelectItem>
                  <SelectItem value="Haryana">Haryana</SelectItem>
                  <SelectItem value="Himachal Pradesh">Himachal Pradesh</SelectItem>
                  <SelectItem value="Jharkhand">Jharkhand</SelectItem>
                  <SelectItem value="Karnataka">Karnataka</SelectItem>
                  <SelectItem value="Kerala">Kerala</SelectItem>
                  <SelectItem value="Madhya Pradesh">Madhya Pradesh</SelectItem>
                  <SelectItem value="Maharashtra">Maharashtra</SelectItem>
                  <SelectItem value="Manipur">Manipur</SelectItem>
                  <SelectItem value="Meghalaya">Meghalaya</SelectItem>
                  <SelectItem value="Mizoram">Mizoram</SelectItem>
                  <SelectItem value="Nagaland">Nagaland</SelectItem>
                  <SelectItem value="Odisha">Odisha</SelectItem>
                  <SelectItem value="Punjab">Punjab</SelectItem>
                  <SelectItem value="Rajasthan">Rajasthan</SelectItem>
                  <SelectItem value="Sikkim">Sikkim</SelectItem>
                  <SelectItem value="Tamil Nadu">Tamil Nadu</SelectItem>
                  <SelectItem value="Telangana">Telangana</SelectItem>
                  <SelectItem value="Tripura">Tripura</SelectItem>
                  <SelectItem value="Uttar Pradesh">Uttar Pradesh</SelectItem>
                  <SelectItem value="Uttarakhand">Uttarakhand</SelectItem>
                  <SelectItem value="West Bengal">West Bengal</SelectItem>
                  <SelectItem value="Delhi">Delhi</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="pincode">Pincode</Label>
              <Input
                id="pincode"
                type="text"
                inputMode="numeric"
                maxLength="6"
                value={formData.pincode}
                onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                placeholder="400001"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="country">Country</Label>
            <Input
              id="country"
              value={formData.country}
              onChange={(e) => setFormData({ ...formData, country: e.target.value })}
              disabled
            />
          </div>

          {/* Relative Information Section */}
          <div className="pt-4 border-t border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Relative Information <span className="text-sm font-normal text-gray-500">(Optional)</span></h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="relativeName">Relative&apos;s Name</Label>
                <Input
                  id="relativeName"
                  value={formData.relativeName}
                  onChange={(e) => setFormData({ ...formData, relativeName: e.target.value })}
                  placeholder="Enter relative's full name"
                />
              </div>

              <div>
                <Label htmlFor="relativeEmail">Relative&apos;s Email</Label>
                <Input
                  id="relativeEmail"
                  type="email"
                  value={formData.relativeEmail}
                  onChange={(e) => setFormData({ ...formData, relativeEmail: e.target.value })}
                  placeholder="relative@example.com"
                />
              </div>

              <div>
                <Label htmlFor="relativeWhatsapp">Relative&apos;s WhatsApp Number</Label>
                <Input
                  id="relativeWhatsapp"
                  type="text"
                  inputMode="numeric"
                  value={formData.relativeWhatsapp}
                  onChange={(e) => setFormData({ ...formData, relativeWhatsapp: e.target.value })}
                  placeholder="+91 98765 43210"
                />
              </div>
            </div>
          </div>

          <Button type="submit" disabled={loading} className="w-full bg-[#2BA89F] hover:bg-[#1E8A82]">
            {loading ? 'Saving...' : 'Complete Profile'}
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default ProfileCreationPage;
