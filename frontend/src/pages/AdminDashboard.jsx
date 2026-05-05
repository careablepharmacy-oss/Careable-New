import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, UserCheck, Pill, FileText, Calendar, Heart, Receipt, 
  AlertTriangle, Clock, ArrowLeft, Phone, Mail, ChevronRight,
  RefreshCw, BarChart3
} from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import apiService from '../services/api';
import { useToast } from '../hooks/use-toast';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState(null);
  const [usersList, setUsersList] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const response = await apiService.get('/api/prescription-manager/dashboard/metrics');
      setMetrics(response);
    } catch (error) {
      console.error('Error fetching metrics:', error);
      toast({
        title: 'Error',
        description: 'Failed to load dashboard metrics',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchUsersByMetric = async (metricType, metricTitle) => {
    try {
      setLoadingUsers(true);
      setSelectedMetric({ type: metricType, title: metricTitle });
      const response = await apiService.get(`/api/prescription-manager/dashboard/users/${metricType}`);
      setUsersList(response.users || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: 'Error',
        description: 'Failed to load users list',
        variant: 'destructive'
      });
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleUserClick = (userId) => {
    // Navigate back to prescription manager with user selected
    navigate(`/prescription-manager?userId=${userId}`);
  };

  const metricCards = [
    {
      key: 'total_users',
      title: 'Total Users',
      icon: Users,
      color: 'bg-blue-500',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-700',
      description: 'Registered users in the system'
    },
    {
      key: 'active_users_24h',
      title: 'Active Users (24h)',
      icon: UserCheck,
      color: 'bg-green-500',
      bgColor: 'bg-green-50',
      textColor: 'text-green-700',
      description: 'Users active in last 24 hours'
    },
    {
      key: 'no_medications',
      title: 'No Medications Added',
      icon: Pill,
      color: 'bg-orange-500',
      bgColor: 'bg-orange-50',
      textColor: 'text-orange-700',
      description: 'Users with empty medications page'
    },
    {
      key: 'no_reports_7d',
      title: 'No Reports (7 Days)',
      icon: FileText,
      color: 'bg-yellow-500',
      bgColor: 'bg-yellow-50',
      textColor: 'text-yellow-700',
      description: 'No report updates in 7 days'
    },
    {
      key: 'no_adherence_7d',
      title: 'No Intake Updates (7 Days)',
      icon: Clock,
      color: 'bg-red-500',
      bgColor: 'bg-red-50',
      textColor: 'text-red-700',
      description: 'No medicine intake in 7 days'
    },
    {
      key: 'no_family_details',
      title: 'No Family Details',
      icon: Heart,
      color: 'bg-pink-500',
      bgColor: 'bg-pink-50',
      textColor: 'text-pink-700',
      description: 'Empty family member section'
    },
    {
      key: 'no_invoices',
      title: 'No Invoices',
      icon: Receipt,
      color: 'bg-purple-500',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-700',
      description: 'No invoice records'
    },
    {
      key: 'critical_stock',
      title: 'Critical Stock Level',
      icon: AlertTriangle,
      color: 'bg-red-600',
      bgColor: 'bg-red-50',
      textColor: 'text-red-700',
      description: '<10 tablets or 1 vial remaining'
    },
    {
      key: 'past_due_appointments',
      title: 'Past-Due Appointments',
      icon: Calendar,
      color: 'bg-amber-500',
      bgColor: 'bg-amber-50',
      textColor: 'text-amber-700',
      description: 'Appointments not updated'
    }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Show users list if a metric is selected
  if (selectedMetric) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b sticky top-0 z-30">
          <div className="p-4 flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setSelectedMetric(null)} 
              className="h-10 w-10 p-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-lg font-bold text-gray-900">{selectedMetric.title}</h1>
              <p className="text-sm text-gray-500">{usersList.length} users</p>
            </div>
          </div>
        </header>

        <div className="p-4">
          {loadingUsers ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : usersList.length === 0 ? (
            <Card className="p-8 text-center">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No users found for this metric</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {usersList.map((user) => (
                <Card 
                  key={user.id}
                  className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => handleUserClick(user.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{user.name}</h3>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {user.email}
                        </span>
                        {user.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {user.phone}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-30">
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/prescription-manager')} 
              className="h-10 w-10 p-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <BarChart3 className="w-6 h-6 text-blue-600" />
                Admin Dashboard
              </h1>
              <p className="text-sm text-gray-500">User engagement metrics</p>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchMetrics}
            className="flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </div>
      </header>

      <div className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {metricCards.map((metric) => {
            const Icon = metric.icon;
            const value = metrics?.[metric.key] ?? 0;
            
            return (
              <Card 
                key={metric.key}
                className={`p-4 cursor-pointer hover:shadow-md transition-all ${metric.bgColor} border-0`}
                onClick={() => fetchUsersByMetric(metric.key, metric.title)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className={`inline-flex p-2 rounded-lg ${metric.color} mb-3`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <h3 className={`text-3xl font-bold ${metric.textColor}`}>
                      {value}
                    </h3>
                    <p className={`text-sm font-medium ${metric.textColor} mt-1`}>
                      {metric.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {metric.description}
                    </p>
                  </div>
                  <ChevronRight className={`w-5 h-5 ${metric.textColor} opacity-50`} />
                </div>
              </Card>
            );
          })}
        </div>

        {/* Summary Section */}
        <Card className="mt-6 p-4 bg-white">
          <h3 className="font-semibold text-gray-900 mb-3">Quick Summary</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Total Registered Users</span>
              <span className="font-medium">{metrics?.total_users || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">24h Activity Rate</span>
              <span className="font-medium">
                {metrics?.total_users ? 
                  Math.round((metrics?.active_users_24h / metrics?.total_users) * 100) : 0}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Users Needing Attention</span>
              <span className="font-medium text-red-600">
                {(metrics?.critical_stock || 0) + (metrics?.past_due_appointments || 0)}
              </span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;
