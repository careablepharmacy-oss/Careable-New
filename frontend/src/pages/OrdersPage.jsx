import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { ChevronLeft } from 'lucide-react';
import BottomNav from '../components/BottomNav';
import OrdersList from '../components/OrdersList';

const OrdersPage = () => {
  const navigate = useNavigate();

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
            data-testid="orders-back-btn"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold text-gray-900">My Orders</h1>
        </div>
      </div>

      <div className="p-4 max-w-lg mx-auto">
        <OrdersList />
      </div>

      <BottomNav active="home" />
    </div>
  );
};

export default OrdersPage;
