import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Utensils } from 'lucide-react';
import { Button } from '../components/ui/button';

const ChatPage = () => {
  const navigate = useNavigate();

  return (
    <div className="bg-gray-50 h-screen flex flex-col">
      {/* Header with Back Button */}
      <div className="bg-gradient-to-r from-[#1E3A5F] via-[#2BA89F] to-[#7AB648] p-4 shadow-lg flex-shrink-0">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/home')}
            className="text-white hover:bg-white/20 p-2 h-auto"
            data-testid="back-to-home-btn"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Utensils className="w-5 h-5 text-white" />
            <div>
              <h1 className="text-lg font-bold text-white">Diet Coach</h1>
              <p className="text-emerald-100 text-xs">Get Diet Advice</p>
            </div>
          </div>
        </div>
      </div>

      {/* JotForm Chatbot Iframe - Full height without bottom nav overlap */}
      <div className="flex-1 overflow-hidden relative">
        <iframe
          src="https://agent.jotform.com/0199f7e58e1b734fb97d463aded95c8ae8c4"
          className="w-full h-full border-0 absolute inset-0"
          title="AI Diet Coach"
          allow="microphone; camera"
        />
      </div>

      {/* No BottomNav on this page - only back button in header */}
    </div>
  );
};

export default ChatPage;
