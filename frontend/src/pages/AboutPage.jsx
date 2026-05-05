import React, { useState, useEffect } from 'react';
import { Card } from '../components/ui/card';
import { Info, Code, Package, Calendar, CheckCircle } from 'lucide-react';
import BottomNav from '../components/BottomNav';

const AboutPage = () => {
  const [versionInfo, setVersionInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVersionInfo();
  }, []);

  const fetchVersionInfo = async () => {
    try {
      const response = await fetch('/version.json', { cache: 'no-store' });
      const data = await response.json();
      setVersionInfo(data);
    } catch (error) {
      console.error('Failed to fetch version:', error);
      setVersionInfo({ version: 'Unknown', buildDate: 'Unknown' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900">About</h1>
      </div>

      <div className="p-6 space-y-4">
        {/* App Info Card */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center">
              <Info className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Careable 360+</h2>
              <p className="text-sm text-gray-600">Enabling Digital Healthcare for All</p>
            </div>
          </div>
          
          <p className="text-gray-700 text-sm leading-relaxed">
            Your comprehensive healthcare tracking and management solution. 
            Never miss a medication, track your health metrics, and manage your wellbeing efficiently.
          </p>
        </Card>

        {/* Version Info Card */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Package className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Version Information</h3>
          </div>

          {loading ? (
            <p className="text-gray-500 text-sm">Loading...</p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-600">App Version</span>
                <span className="text-sm font-mono font-semibold text-blue-600">
                  {versionInfo?.version || 'Unknown'}
                </span>
              </div>
              
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-600">Build Date</span>
                <span className="text-sm font-mono text-gray-900">
                  {versionInfo?.buildDate || 'Unknown'}
                </span>
              </div>

              {versionInfo?.description && (
                <div className="pt-2">
                  <p className="text-xs text-gray-600">{versionInfo.description}</p>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Features Card */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <h3 className="font-semibold text-gray-900">Key Features</h3>
          </div>

          <ul className="space-y-2">
            <li className="flex items-start gap-2 text-sm text-gray-700">
              <span className="text-green-600 mt-0.5">✓</span>
              <span>Hybrid stock tracking for tablets and injections</span>
            </li>
            <li className="flex items-start gap-2 text-sm text-gray-700">
              <span className="text-green-600 mt-0.5">✓</span>
              <span>Different dosages at different times</span>
            </li>
            <li className="flex items-start gap-2 text-sm text-gray-700">
              <span className="text-green-600 mt-0.5">✓</span>
              <span>Auto-detection for 221+ insulin products</span>
            </li>
            <li className="flex items-start gap-2 text-sm text-gray-700">
              <span className="text-green-600 mt-0.5">✓</span>
              <span>Smart stock depletion by count/IU</span>
            </li>
            <li className="flex items-start gap-2 text-sm text-gray-700">
              <span className="text-green-600 mt-0.5">✓</span>
              <span>Push notifications and alarms</span>
            </li>
            <li className="flex items-start gap-2 text-sm text-gray-700">
              <span className="text-green-600 mt-0.5">✓</span>
              <span>Adherence tracking and reports</span>
            </li>
          </ul>
        </Card>

        {/* Developer Info */}
        <Card className="p-6 bg-gray-50">
          <div className="flex items-center gap-2 mb-3">
            <Code className="w-5 h-5 text-gray-600" />
            <h3 className="font-semibold text-gray-900">Technical Info</h3>
          </div>
          
          <div className="space-y-2 text-xs text-gray-600">
            <p>• React + Capacitor Native App</p>
            <p>• FastAPI Backend</p>
            <p>• MongoDB Database</p>
            <p>• PWA with Service Worker</p>
          </div>
        </Card>

        {/* Contact/Support Card */}
        <Card className="p-6 bg-blue-50 border-blue-200">
          <h3 className="font-semibold text-blue-900 mb-2">Need Help?</h3>
          <p className="text-sm text-blue-700">
            For support or feedback, please contact your prescription manager 
            or visit the admin dashboard.
          </p>
        </Card>
      </div>

      <BottomNav />
    </div>
  );
};

export default AboutPage;
