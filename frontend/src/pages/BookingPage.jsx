import React, { useState } from 'react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { ArrowLeft, Stethoscope, FlaskConical } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from '../hooks/use-toast';
import apiService from '../services/api';

const BookingPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const bookingType = location.state?.type || 'doctor'; // 'doctor' or 'lab'
  
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    type: bookingType,
    title: '',
    date: '',
    time: '',
    doctor: '',
    location: '',
    notes: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await apiService.createAppointment({
        type: formData.type,
        title: formData.title,
        date: formData.date,
        time: formData.time,
        doctor: formData.type === 'doctor' ? formData.doctor : undefined,
        location: formData.location,
        notes: formData.notes,
        status: 'upcoming'
      });
      
      toast({
        title: 'Success!',
        description: `${formData.type === 'doctor' ? 'Doctor' : 'Lab'} appointment booked successfully`,
      });
      
      navigate('/home');
    } catch (error) {
      console.error('Failed to book appointment:', error);
      toast({
        title: 'Error',
        description: 'Failed to book appointment. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="p-4 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="h-10 w-10 p-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            {formData.type === 'doctor' ? (
              <Stethoscope className="w-5 h-5 text-blue-600" />
            ) : (
              <FlaskConical className="w-5 h-5 text-purple-600" />
            )}
            <h1 className="text-xl font-bold text-gray-900">
              Book {formData.type === 'doctor' ? 'Doctor' : 'Lab Test'}
            </h1>
          </div>
        </div>
      </div>

      <div className="p-4">
        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Booking Type */}
            <div>
              <Label htmlFor="type">Appointment Type</Label>
              <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="doctor">Doctor Consultation</SelectItem>
                  <SelectItem value="lab">Lab Test</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Title */}
            <div>
              <Label htmlFor="title">
                {formData.type === 'doctor' ? 'Reason for Visit' : 'Test Name'} *
              </Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder={formData.type === 'doctor' ? 'e.g., Regular Checkup' : 'e.g., HbA1c Test'}
                required
              />
            </div>

            {/* Doctor Name (only for doctor appointments) */}
            {formData.type === 'doctor' && (
              <div>
                <Label htmlFor="doctor">Doctor Name</Label>
                <Input
                  id="doctor"
                  value={formData.doctor}
                  onChange={(e) => setFormData({ ...formData, doctor: e.target.value })}
                  placeholder="e.g., Dr. Smith"
                />
              </div>
            )}

            {/* Location */}
            <div>
              <Label htmlFor="location">
                {formData.type === 'doctor' ? 'Clinic/Hospital' : 'Lab Location'} *
              </Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder={formData.type === 'doctor' ? 'e.g., City Medical Center' : 'e.g., LabCorp'}
                required
              />
            </div>

            {/* Date and Time */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>
              <div>
                <Label htmlFor="time">Time *</Label>
                <Input
                  id="time"
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  required
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <Label htmlFor="notes">Additional Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any special instructions or requirements..."
                rows={3}
              />
            </div>

            {/* Submit Buttons */}
            <div className="space-y-2 pt-2">
              <Button type="submit" disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-700">
                {loading ? 'Booking...' : 'Book Appointment'}
              </Button>
              <Button type="button" variant="outline" className="w-full" onClick={() => navigate('/home')}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default BookingPage;
