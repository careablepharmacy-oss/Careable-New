import React from 'react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PrivacyPolicyPage = () => {
  const navigate = useNavigate();

  return (
    <div className="pb-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="p-4 flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate(-1)} 
            className="h-10 w-10 p-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold text-gray-900">Privacy Policy</h1>
        </div>
      </div>

      <div className="p-4">
        <Card className="p-6">
          <div className="prose prose-sm max-w-none">
            <p className="text-gray-600 mb-4">Last updated: January 20, 2025</p>
            
            <h2 className="text-lg font-semibold text-gray-900 mt-6 mb-3">1. Information We Collect</h2>
            <p className="text-gray-700 mb-4">
              We collect information you provide directly to us, including your name, email address, phone number, 
              health data (blood glucose readings, blood pressure, weight, medications), and any other information 
              you choose to provide.
            </p>

            <h2 className="text-lg font-semibold text-gray-900 mt-6 mb-3">2. How We Use Your Information</h2>
            <p className="text-gray-700 mb-4">
              We use the information we collect to:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
              <li>Provide, maintain, and improve our services</li>
              <li>Send you medication reminders and health alerts</li>
              <li>Provide customer support</li>
              <li>Monitor and analyze usage patterns</li>
              <li>Protect against fraudulent or illegal activity</li>
            </ul>

            <h2 className="text-lg font-semibold text-gray-900 mt-6 mb-3">3. Data Security</h2>
            <p className="text-gray-700 mb-4">
              We implement appropriate technical and organizational measures to protect your personal data against 
              unauthorized access, alteration, disclosure, or destruction. Your health data is encrypted both in 
              transit and at rest.
            </p>

            <h2 className="text-lg font-semibold text-gray-900 mt-6 mb-3">4. HIPAA Compliance</h2>
            <p className="text-gray-700 mb-4">
              DiabeXpert is committed to complying with HIPAA regulations for the protection of your health information. 
              We maintain appropriate safeguards to ensure the privacy and security of your protected health information (PHI).
            </p>

            <h2 className="text-lg font-semibold text-gray-900 mt-6 mb-3">5. Data Sharing</h2>
            <p className="text-gray-700 mb-4">
              We do not sell your personal information. We may share your information only:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
              <li>With your explicit consent</li>
              <li>With healthcare providers you authorize</li>
              <li>To comply with legal obligations</li>
              <li>To protect our rights and safety</li>
            </ul>

            <h2 className="text-lg font-semibold text-gray-900 mt-6 mb-3">6. Your Rights</h2>
            <p className="text-gray-700 mb-4">
              You have the right to:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
              <li>Access your personal data</li>
              <li>Correct inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Export your data</li>
              <li>Opt-out of marketing communications</li>
            </ul>

            <h2 className="text-lg font-semibold text-gray-900 mt-6 mb-3">7. Contact Us</h2>
            <p className="text-gray-700 mb-4">
              If you have questions about this Privacy Policy, please contact us at:
            </p>
            <p className="text-gray-700 mb-2">Email: privacy@diabexpert.com</p>
            <p className="text-gray-700 mb-2">Phone: 1-800-555-1234</p>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default PrivacyPolicyPage;
