import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import {
  CheckCircle2,
  Package,
  MapPin,
  CreditCard,
  ChevronLeft,
  ShoppingBag,
  FileText,
  Truck
} from 'lucide-react';
import BottomNav from '../components/BottomNav';
import apiService from '../services/api';

const OrderConfirmationPage = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrder();
  }, [orderId]);

  const fetchOrder = async () => {
    try {
      const data = await apiService.get(`/api/orders/${orderId}`);
      setOrder(data);
    } catch (error) {
      console.error('Failed to fetch order:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="pb-20 bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="pb-20 bg-gray-50 min-h-screen flex flex-col items-center justify-center p-4">
        <Package className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-bold text-gray-700 mb-2">Order Not Found</h2>
        <Button onClick={() => navigate('/home')} data-testid="go-home-btn">Go Home</Button>
      </div>
    );
  }

  const billing = order.billing_address || {};
  const shipping = order.shipping_address || {};
  const orderDate = order.created_at ? new Date(order.created_at).toLocaleDateString('en-IN', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
  }) : '';

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
            data-testid="confirmation-back-btn"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold text-gray-900">Order Confirmation</h1>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-lg mx-auto">
        {/* Success Banner */}
        <Card className="p-6 bg-gradient-to-br from-[#E6F4F2] to-[#F0F7E5] border-[#2BA89F]/30 text-center" data-testid="order-success-banner">
          <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-3" />
          <h2 className="text-2xl font-bold text-emerald-800 mb-1">Order Confirmed!</h2>
          <p className="text-emerald-600 text-sm">Thank you for your purchase</p>
          <div className="mt-4 bg-white rounded-lg p-3 inline-block">
            <p className="text-xs text-gray-500">Order Number</p>
            <p className="text-lg font-bold text-gray-900" data-testid="order-number">{order.order_number}</p>
          </div>
          <p className="text-xs text-gray-500 mt-3">{orderDate}</p>
        </Card>

        {/* Payment Info */}
        <Card className="p-4" data-testid="payment-info-section">
          <div className="flex items-center gap-2 mb-3">
            <CreditCard className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-gray-900">Payment Details</h3>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Payment Status</span>
              <span className={`font-semibold ${order.payment_status === 'paid' ? 'text-emerald-600' : 'text-red-600'}`}>
                {order.payment_status === 'paid' ? 'Paid' : 'Pending'}
              </span>
            </div>
            {order.razorpay_payment_id && (
              <div className="flex justify-between">
                <span className="text-gray-600">Transaction ID</span>
                <span className="font-mono text-xs text-gray-800">{order.razorpay_payment_id}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-600">Payment Method</span>
              <span className="text-gray-800">Razorpay</span>
            </div>
          </div>
        </Card>

        {/* Order Items (Invoice) */}
        <Card className="p-4" data-testid="order-items-section">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-5 h-5 text-orange-600" />
            <h3 className="font-bold text-gray-900">Invoice Summary</h3>
          </div>

          <div className="space-y-3">
            {order.items?.map((item, idx) => (
              <div key={idx} className="flex items-center gap-3 py-2 border-b last:border-0">
                <div className="w-10 h-10 bg-gray-100 rounded flex-shrink-0 overflow-hidden">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.product_name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-4 h-4 text-gray-300" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 line-clamp-1">{item.product_name}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>₹{item.selling_price?.toLocaleString('en-IN')} x {item.quantity}</span>
                    {item.mrp > item.selling_price && (
                      <span className="line-through text-gray-400">₹{item.mrp?.toLocaleString('en-IN')}</span>
                    )}
                  </div>
                </div>
                <p className="font-semibold text-gray-900 text-sm">
                  ₹{item.item_total?.toLocaleString('en-IN')}
                </p>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="mt-4 pt-3 border-t space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Subtotal</span>
              <span>₹{order.subtotal?.toLocaleString('en-IN')}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount</span>
                <span>-₹{order.discount?.toLocaleString('en-IN')}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-600">Delivery</span>
              <span className="text-green-600">FREE</span>
            </div>
            <div className="flex justify-between pt-3 border-t text-lg font-bold">
              <span>Total Paid</span>
              <span className="text-emerald-600">₹{order.total?.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </Card>

        {/* Addresses */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="p-4" data-testid="billing-address-info">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="w-4 h-4 text-emerald-600" />
              <h4 className="font-bold text-gray-900 text-sm">Billing Address</h4>
            </div>
            <div className="text-sm text-gray-600 space-y-0.5">
              <p className="font-medium text-gray-900">{billing.full_name}</p>
              <p>{billing.address_line1}</p>
              {billing.address_line2 && <p>{billing.address_line2}</p>}
              <p>{[billing.city, billing.state, billing.pincode].filter(Boolean).join(', ')}</p>
              <p>{billing.phone}</p>
            </div>
          </Card>

          <Card className="p-4" data-testid="shipping-address-info">
            <div className="flex items-center gap-2 mb-2">
              <Truck className="w-4 h-4 text-blue-600" />
              <h4 className="font-bold text-gray-900 text-sm">Shipping Address</h4>
            </div>
            <div className="text-sm text-gray-600 space-y-0.5">
              <p className="font-medium text-gray-900">{shipping.full_name}</p>
              <p>{shipping.address_line1}</p>
              {shipping.address_line2 && <p>{shipping.address_line2}</p>}
              <p>{[shipping.city, shipping.state, shipping.pincode].filter(Boolean).join(', ')}</p>
              <p>{shipping.phone}</p>
            </div>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => navigate('/home')}
            data-testid="continue-shopping-btn"
          >
            <ShoppingBag className="w-4 h-4 mr-2" />
            Continue Shopping
          </Button>
          <Button
            className="flex-1 bg-emerald-600 hover:bg-emerald-700"
            onClick={() => navigate('/orders')}
            data-testid="view-orders-btn"
          >
            <Package className="w-4 h-4 mr-2" />
            My Orders
          </Button>
        </div>
      </div>

      <BottomNav active="home" />
    </div>
  );
};

export default OrderConfirmationPage;
