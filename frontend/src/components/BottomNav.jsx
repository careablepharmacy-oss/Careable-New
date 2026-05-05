import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, Pill, TrendingUp, Wallet } from 'lucide-react';

const BottomNav = ({ active }) => {
  const navigate = useNavigate();

  const navItems = [
    { id: 'home', label: 'Home', icon: Home, path: '/home' },
    { id: 'medications', label: 'Meds', icon: Pill, path: '/medications' },
    { id: 'reports', label: 'Reports', icon: TrendingUp, path: '/reports' },
    {
      id: 'records',
      label: 'Records',
      icon: Wallet,
      path: null,
      externalUrl: 'https://health-wallet-4.emergent.host',
    },
  ];

  const handleNavClick = (item) => {
    if (item.externalUrl) {
      window.open(item.externalUrl, '_blank');
    } else if (item.path) {
      navigate(item.path);
    }
  };

  return (
    <div
      className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-[9998]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      data-testid="bottom-nav"
    >
      <div className="max-w-md mx-auto">
        <div className="grid grid-cols-4 items-stretch px-2 py-2.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item)}
                data-testid={`bottom-nav-${item.id}`}
                className={`relative flex flex-col items-center justify-center gap-1 py-2 mx-1 rounded-2xl transition-all duration-200 active:scale-[0.96] ${
                  isActive
                    ? 'bg-[#2BA89F]/12'
                    : 'hover:bg-gray-50'
                }`}
              >
                {/* Top accent pill on active */}
                <span
                  className={`absolute top-0 left-1/2 -translate-x-1/2 h-[3px] w-8 rounded-full transition-all ${
                    isActive ? 'bg-[#E8A93C]' : 'bg-transparent'
                  }`}
                />
                <Icon
                  className={`w-6 h-6 transition-colors ${
                    isActive ? 'text-[#1E3A5F]' : 'text-gray-400'
                  }`}
                  strokeWidth={isActive ? 2.4 : 2}
                />
                <span
                  className={`text-[12px] font-semibold tracking-tight ${
                    isActive ? 'text-[#1E3A5F]' : 'text-gray-500'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default BottomNav;
