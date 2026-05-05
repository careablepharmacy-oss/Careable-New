import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { Bell, Pill, Plus, Calendar, TrendingUp, AlertCircle, CheckCircle, Clock, Menu, X } from 'lucide-react';
import { mockMedications, mockAdherenceLog, mockUser } from '../mockData';

const Dashboard = () => {
  const navigate = useNavigate();
  const [selectedDate] = useState(new Date());
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const todayDate = selectedDate.toISOString().split('T')[0];
  
  const todaySchedule = useMemo(() => {
    const schedule = [];
    mockMedications.forEach(med => {
      if (med.schedule.frequency === 'daily') {
        med.schedule.times.forEach(time => {
          const log = mockAdherenceLog.find(
            l => l.medicationId === med.id && l.scheduledTime === time && l.date === todayDate
          );
          schedule.push({
            ...med,
            scheduledTime: time,
            status: log?.status || 'pending',
            takenTime: log?.takenTime
          });
        });
      }
    });
    return schedule.sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));
  }, [todayDate]);

  const adherenceStats = useMemo(() => {
    const total = mockAdherenceLog.filter(l => l.status !== 'pending').length;
    const taken = mockAdherenceLog.filter(l => l.status === 'taken').length;
    return {
      rate: total > 0 ? Math.round((taken / total) * 100) : 0,
      taken,
      total
    };
  }, []);

  const upcomingDoses = todaySchedule.filter(s => s.status === 'pending');
  const completedDoses = todaySchedule.filter(s => s.status === 'taken');
  const refillNeeded = mockMedications.filter(m => m.refillReminder.enabled && m.refillReminder.pillsRemaining <= m.refillReminder.threshold);

  const handleMarkAsTaken = (medication) => {
    // Mock functionality - will be replaced with actual API call
    console.log('Marked as taken:', medication);
  };

  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    navigate('/');
  };

  const Sidebar = () => (
    <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-green-500 rounded-xl flex items-center justify-center">
              <Pill className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">MediCare</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <nav className="space-y-2">
          <Button 
            variant="ghost" 
            className="w-full justify-start bg-blue-50 text-blue-700 hover:bg-blue-100"
            onClick={() => navigate('/dashboard')}
          >
            <Calendar className="w-5 h-5 mr-3" />
            Today
          </Button>
          <Button 
            variant="ghost" 
            className="w-full justify-start hover:bg-gray-100"
            onClick={() => navigate('/medications')}
          >
            <Pill className="w-5 h-5 mr-3" />
            Medications
          </Button>
          <Button 
            variant="ghost" 
            className="w-full justify-start hover:bg-gray-100"
            onClick={() => navigate('/schedule')}
          >
            <Bell className="w-5 h-5 mr-3" />
            Schedule
          </Button>
          <Button 
            variant="ghost" 
            className="w-full justify-start hover:bg-gray-100"
            onClick={() => navigate('/reports')}
          >
            <TrendingUp className="w-5 h-5 mr-3" />
            Reports
          </Button>
        </nav>
      </div>
      
      <div className="absolute bottom-0 left-0 right-0 p-6 border-t">
        <div className="flex items-center gap-3 mb-4">
          <img src={mockUser.avatar} alt={mockUser.name} className="w-10 h-10 rounded-full" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{mockUser.name}</p>
            <p className="text-xs text-gray-500 truncate">{mockUser.email}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="w-full" onClick={handleLogout}>
          Sign Out
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar />
      
      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden" 
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {/* Header */}
        <header className="bg-white border-b sticky top-0 z-30">
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => setSidebarOpen(true)} className="lg:hidden">
                <Menu className="w-6 h-6" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Today's Schedule</h1>
                <p className="text-sm text-gray-500">{selectedDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>
            </div>
            <Button onClick={() => navigate('/medications/add')} className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800">
              <Plus className="w-5 h-5 mr-2" />
              Add Medication
            </Button>
          </div>
        </header>

        <div className="p-6 space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-blue-700">Adherence Rate</span>
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              <div className="text-3xl font-bold text-blue-900 mb-2">{adherenceStats.rate}%</div>
              <Progress value={adherenceStats.rate} className="h-2" />
            </Card>

            <Card className="p-6 bg-gradient-to-br from-green-50 to-green-100 border-green-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-green-700">Today's Doses</span>
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div className="text-3xl font-bold text-green-900">{completedDoses.length}/{todaySchedule.length}</div>
              <p className="text-sm text-green-700 mt-1">{upcomingDoses.length} pending</p>
            </Card>

            <Card className="p-6 bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-purple-700">Active Meds</span>
                <Pill className="w-5 h-5 text-purple-600" />
              </div>
              <div className="text-3xl font-bold text-purple-900">{mockMedications.length}</div>
              <p className="text-sm text-purple-700 mt-1">medications</p>
            </Card>

            <Card className="p-6 bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-orange-700">Refill Needed</span>
                <AlertCircle className="w-5 h-5 text-orange-600" />
              </div>
              <div className="text-3xl font-bold text-orange-900">{refillNeeded.length}</div>
              <p className="text-sm text-orange-700 mt-1">medications</p>
            </Card>
          </div>

          {/* Refill Alerts */}
          {refillNeeded.length > 0 && (
            <Card className="p-6 bg-orange-50 border-orange-200">
              <div className="flex items-center gap-2 mb-4">
                <AlertCircle className="w-5 h-5 text-orange-600" />
                <h2 className="text-lg font-semibold text-orange-900">Refill Reminders</h2>
              </div>
              <div className="space-y-3">
                {refillNeeded.map(med => (
                  <div key={med.id} className="flex items-center justify-between p-3 bg-white rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: med.color + '30' }}>
                        <Pill className="w-5 h-5" style={{ color: med.color }} />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{med.name}</p>
                        <p className="text-sm text-gray-600">{med.refillReminder.pillsRemaining} pills remaining</p>
                      </div>
                    </div>
                    <Button size="sm" variant="outline">Order Refill</Button>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Today's Schedule */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-6 text-gray-900">Medication Schedule</h2>
            <div className="space-y-4">
              {todaySchedule.length === 0 ? (
                <div className="text-center py-12">
                  <Clock className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500">No medications scheduled for today</p>
                </div>
              ) : (
                todaySchedule.map((item, index) => (
                  <div 
                    key={index} 
                    className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-200 ${
                      item.status === 'taken' 
                        ? 'bg-green-50 border-green-200' 
                        : item.status === 'pending'
                        ? 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-md'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: item.color + '30' }}>
                      <Pill className="w-6 h-6" style={{ color: item.color }} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900">{item.name}</h3>
                        <span className="text-sm text-gray-500">•</span>
                        <span className="text-sm text-gray-500">{item.dosage}</span>
                      </div>
                      <p className="text-sm text-gray-600">{item.instructions}</p>
                      <p className="text-xs text-gray-500 mt-1">Scheduled: {item.scheduledTime}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {item.status === 'taken' ? (
                        <div className="flex items-center gap-2 text-green-600">
                          <CheckCircle className="w-6 h-6" />
                          <span className="text-sm font-medium">Taken</span>
                        </div>
                      ) : (
                        <Button 
                          onClick={() => handleMarkAsTaken(item)}
                          className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
                        >
                          Mark as Taken
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
