import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Checkbox } from '../components/ui/checkbox';
import {
  ChevronLeft,
  MapPin,
  Truck,
  CreditCard,
  Shield,
  Package
} from 'lucide-react';
import BottomNav from '../components/BottomNav';
import apiService from '../services/api';
import { toast } from 'sonner';

const EMPTY_ADDRESS = {
  full_name: '',
  phone: '',
  address_line1: '',
  address_line2: '',
  city: '',
  state: '',
  pincode: '',
  country: 'India'
};

const AddressForm = ({ address, onChange, prefix, disabled = false }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
    <div className="sm:col-span-2">
      <Label htmlFor={`${prefix}-name`} className="text-xs text-gray-600">Full Name *</Label>
      <Input
        id={`${prefix}-name`}
        value={address.full_name}
        onChange={e => onChange('full_name', e.target.value)}
        placeholder="Full name"
        disabled={disabled}
        data-testid={`${prefix}-full-name`}
      />
    </div>
    <div className="sm:col-span-2">
      <Label htmlFor={`${prefix}-phone`} className="text-xs text-gray-600">Phone *</Label>
      <Input
        id={`${prefix}-phone`}
        value={address.phone}
        onChange={e => onChange('phone', e.target.value)}
        placeholder="10-digit phone number"
        maxLength={10}
        disabled={disabled}
        data-testid={`${prefix}-phone`}
      />
    </div>
    <div className="sm:col-span-2">
      <Label htmlFor={`${prefix}-addr1`} className="text-xs text-gray-600">Address Line 1 *</Label>
      <Input
        id={`${prefix}-addr1`}
        value={address.address_line1}
        onChange={e => onChange('address_line1', e.target.value)}
        placeholder="House no., Street, Area"
        disabled={disabled}
        data-testid={`${prefix}-address-line1`}
      />
    </div>
    <div className="sm:col-span-2">
      <Label htmlFor={`${prefix}-addr2`} className="text-xs text-gray-600">Address Line 2</Label>
      <Input
        id={`${prefix}-addr2`}
        value={address.address_line2}
        onChange={e => onChange('address_line2', e.target.value)}
        placeholder="Landmark, Colony (optional)"
        disabled={disabled}
        data-testid={`${prefix}-address-line2`}
      />
    </div>
    <div>
      <Label htmlFor={`${prefix}-city`} className="text-xs text-gray-600">City *</Label>
      <Input
        id={`${prefix}-city`}
        value={address.city}
        onChange={e => onChange('city', e.target.value)}
        placeholder="City"
        disabled={disabled}
        data-testid={`${prefix}-city`}
      />
    </div>
    <div>
      <Label htmlFor={`${prefix}-state`} className="text-xs text-gray-600">State *</Label>
      <Input
        id={`${prefix}-state`}
        value={address.state}
        onChange={e => onChange('state', e.target.value)}
        placeholder="State"
        disabled={disabled}
        data-testid={`${prefix}-state`}
      />
    </div>
    <div>
      <Label htmlFor={`${prefix}-pin`} className="text-xs text-gray-600">PIN Code *</Label>
      <Input
        id={`${prefix}-pin`}
        value={address.pincode}
        onChange={e => onChange('pincode', e.target.value)}
        placeholder="6-digit PIN"
        maxLength={6}
        disabled={disabled}
        data-testid={`${prefix}-pincode`}
      />
    </div>
    <div>
      <Label htmlFor={`${prefix}-country`} className="text-xs text-gray-600">Country</Label>
      <Input
        id={`${prefix}-country`}
        value={address.country}
        disabled
        data-testid={`${prefix}-country`}
      />
    </div>
  </div>
);

const CheckoutPage = () => {
  const navigate = useNavigate();
  const [cart, setCart] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [billingAddress, setBillingAddress] = useState({ ...EMPTY_ADDRESS });
  const [shippingAddress, setShippingAddress] = useState({ ...EMPTY_ADDRESS });
  const [sameAsBilling, setSameAsBilling] = useState(true);
  const [profileLoaded, setProfileLoaded] = useState(false);

  useEffect(() => {
    loadData();
    loadRazorpayScript();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [cartData, profile] = await Promise.all([
        apiService.get('/api/cart'),
        apiService.get('/api/users/me')
      ]);
      setCart(cartData);

      if (cartData.items?.length === 0) {
        navigate('/cart');
        return;
      }

      // Pre-fill billing address from profile if available
      if (profile && (profile.address || profile.phone)) {
        const profileAddress = {
          full_name: profile.name || '',
          phone: profile.phone || '',
          address_line1: profile.address || '',
          address_line2: '',
          city: profile.city || '',
          state: profile.state || '',
          pincode: profile.pincode || '',
          country: profile.country || 'India'
        };
        setBillingAddress(profileAddress);
        setShippingAddress({ ...profileAddress });
        setProfileLoaded(true);
      }
    } catch (error) {
      console.error('Failed to load checkout data:', error);
      toast.error('Failed to load checkout data');
    } finally {
      setLoading(false);
    }
  };

  const loadRazorpayScript = () => {
    if (document.getElementById('razorpay-script')) return;
    const script = document.createElement('script');
    script.id = 'razorpay-script';
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);
  };

  const updateBilling = (field, value) => {
    const updated = { ...billingAddress, [field]: value };
    setBillingAddress(updated);
    if (sameAsBilling) {
      setShippingAddress({ ...updated });
    }
  };

  const updateShipping = (field, value) => {
    setShippingAddress(prev => ({ ...prev, [field]: value }));
  };

  const handleSameAsBilling = (checked) => {
    setSameAsBilling(checked);
    if (checked) {
      setShippingAddress({ ...billingAddress });
    }
  };

  const validateAddress = (addr, label) => {
    const required = ['full_name', 'phone', 'address_line1', 'state', 'pincode'];
    for (const field of required) {
      if (!addr[field]?.trim()) {
        const fieldLabel = field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        toast.error(`${fieldLabel} is required in ${label}`);
        return false;
      }
    }
    if (!/^\d{6}$/.test(addr.pincode.trim())) {
      toast.error(`Enter a valid 6-digit PIN code for ${label}`);
      return false;
    }
    if (!/^\d{10}$/.test(addr.phone.trim())) {
      toast.error(`Enter a valid 10-digit phone number for ${label}`);
      return false;
    }
    return true;
  };

  const handleCheckout = async () => {
    if (!validateAddress(billingAddress, 'Billing Address')) return;
    const shipAddr = sameAsBilling ? billingAddress : shippingAddress;
    if (!sameAsBilling && !validateAddress(shippingAddress, 'Shipping Address')) return;

    setProcessing(true);
    try {
      // Create order on backend
      const orderData = await apiService.post('/api/checkout/create-order', {
        billing_address: billingAddress,
        shipping_address: shipAddr
      });

      // Open Razorpay checkout
      const options = {
        key: orderData.razorpay_key_id,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'Careable 360+ Store',
        description: `Order ${orderData.order_number}`,
        order_id: orderData.razorpay_order_id,
        handler: async (response) => {
          // Verify payment on backend
          try {
            const result = await apiService.post('/api/checkout/verify-payment', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              order_id: orderData.order_id
            });
            if (result.success) {
              navigate(`/order-confirmation/${orderData.order_id}`);
            }
          } catch (err) {
            console.error('Payment verification failed:', err);
            toast.error('Payment verification failed. Please contact support.');
          }
          setProcessing(false);
        },
        prefill: {
          name: orderData.user_name,
          email: orderData.user_email,
          contact: orderData.user_phone
        },
        theme: { color: '#059669' },
        modal: {
          ondismiss: () => {
            setProcessing(false);
            toast('Payment cancelled');
          }
        }
      };

      if (window.Razorpay) {
        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', (response) => {
          setProcessing(false);
          toast.error(response.error?.description || 'Payment failed. Please try again.');
        });
        rzp.open();
      } else {
        throw new Error('Razorpay SDK not loaded');
      }
    } catch (error) {
      console.error('Checkout failed:', error);
      toast.error(error.message || 'Failed to initiate payment');
      setProcessing(false);
    }
  };

  const totalSavings = cart.items?.reduce((sum, item) => {
    return sum + (item.product.mrp - item.product.selling_price) * item.quantity;
  }, 0) || 0;

  if (loading) {
    return (
      <div className="pb-20 bg-gray-50 min-h-screen">
        <div className="bg-white p-4 border-b">
          <div className="h-6 bg-gray-200 rounded w-40 animate-pulse" />
        </div>
        <div className="p-4 space-y-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-3" />
              <div className="space-y-2">
                <div className="h-10 bg-gray-200 rounded" />
                <div className="h-10 bg-gray-200 rounded" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="pb-24 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-white p-4 border-b sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/cart')}
            className="p-2"
            data-testid="checkout-back-btn"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold text-gray-900">Checkout</h1>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-lg mx-auto">
        {/* Billing Address */}
        <Card className="p-4" data-testid="billing-address-section">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="w-5 h-5 text-emerald-600" />
            <h2 className="font-bold text-gray-900">Billing Address</h2>
            {profileLoaded && (
              <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full ml-auto">
                From Profile
              </span>
            )}
          </div>
          <AddressForm address={billingAddress} onChange={updateBilling} prefix="billing" />
        </Card>

        {/* Shipping Address */}
        <Card className="p-4" data-testid="shipping-address-section">
          <div className="flex items-center gap-2 mb-4">
            <Truck className="w-5 h-5 text-blue-600" />
            <h2 className="font-bold text-gray-900">Shipping Address</h2>
          </div>
          <div className="flex items-center gap-2 mb-4">
            <Checkbox
              id="same-as-billing"
              checked={sameAsBilling}
              onCheckedChange={handleSameAsBilling}
              data-testid="same-as-billing-checkbox"
            />
            <Label htmlFor="same-as-billing" className="text-sm text-gray-700 cursor-pointer">
              Same as billing address
            </Label>
          </div>
          {!sameAsBilling && (
            <AddressForm address={shippingAddress} onChange={updateShipping} prefix="shipping" />
          )}
          {sameAsBilling && (
            <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
              <p>{billingAddress.full_name}</p>
              <p>{billingAddress.address_line1}</p>
              {billingAddress.address_line2 && <p>{billingAddress.address_line2}</p>}
              <p>{[billingAddress.city, billingAddress.state, billingAddress.pincode].filter(Boolean).join(', ')}</p>
              <p>{billingAddress.phone}</p>
            </div>
          )}
        </Card>

        {/* Order Summary */}
        <Card className="p-4" data-testid="order-summary-section">
          <div className="flex items-center gap-2 mb-4">
            <Package className="w-5 h-5 text-orange-600" />
            <h2 className="font-bold text-gray-900">Order Summary</h2>
          </div>

          <div className="space-y-3">
            {cart.items?.map(item => (
              <div key={item.product_id} className="flex items-center gap-3 py-2 border-b last:border-0">
                <div className="w-12 h-12 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden">
                  {item.product.image_url ? (
                    <img src={item.product.image_url} alt={item.product.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-5 h-5 text-gray-300" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 line-clamp-1">{item.product.name}</p>
                  <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                </div>
                <p className="font-semibold text-gray-900 text-sm">
                  ₹{item.item_total.toLocaleString('en-IN')}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Subtotal</span>
              <span>₹{cart.total?.toLocaleString('en-IN')}</span>
            </div>
            {totalSavings > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Total Savings</span>
                <span>-₹{totalSavings.toLocaleString('en-IN')}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-600">Delivery</span>
              <span className="text-green-600 font-medium">FREE</span>
            </div>
            <div className="flex justify-between pt-3 border-t text-lg font-bold">
              <span>Total</span>
              <span className="text-emerald-600">₹{cart.total?.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </Card>

        {/* Pay Button */}
        <div className="sticky bottom-16 bg-white p-4 -mx-4 border-t shadow-lg z-[9999]" data-testid="payment-section">
          <div className="flex items-center gap-2 mb-3 justify-center">
            <Shield className="w-4 h-4 text-emerald-600" />
            <span className="text-xs text-gray-500">Secured by Razorpay</span>
          </div>
          <Button
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-6 text-lg"
            onClick={handleCheckout}
            disabled={processing}
            data-testid="pay-now-btn"
          >
            {processing ? (
              <span className="flex items-center gap-2">
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Processing...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Pay ₹{cart.total?.toLocaleString('en-IN')}
              </span>
            )}
          </Button>
        </div>
      </div>

      <BottomNav active="home" />
    </div>
  );
};

export default CheckoutPage;
