import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { 
  ChevronLeft,
  Minus,
  Plus,
  Trash2,
  ShoppingBag,
  Package,
  ArrowRight
} from 'lucide-react';
import BottomNav from '../components/BottomNav';
import apiService from '../services/api';
import { toast } from '../hooks/use-toast';

const CartPage = () => {
  const navigate = useNavigate();
  const [cart, setCart] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);

  useEffect(() => {
    fetchCart();
  }, []);

  const fetchCart = async () => {
    try {
      setLoading(true);
      const data = await apiService.get('/api/cart');
      setCart(data);
    } catch (error) {
      console.error('Failed to fetch cart:', error);
      toast({
        title: 'Error',
        description: 'Failed to load cart',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = async (productId, newQuantity) => {
    setUpdating(productId);
    try {
      const data = await apiService.request(`/api/cart/update?product_id=${productId}`, {
        method: 'PUT',
        body: JSON.stringify({ quantity: newQuantity })
      });
      setCart(data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update quantity',
        variant: 'destructive'
      });
    } finally {
      setUpdating(null);
    }
  };

  const removeItem = async (productId) => {
    setUpdating(productId);
    try {
      const data = await apiService.request(`/api/cart/remove/${productId}`, {
        method: 'DELETE'
      });
      setCart(data);
      toast({
        title: 'Removed',
        description: 'Item removed from cart',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to remove item',
        variant: 'destructive'
      });
    } finally {
      setUpdating(null);
    }
  };

  const clearCart = async () => {
    try {
      const data = await apiService.request('/api/cart/clear', {
        method: 'DELETE'
      });
      setCart(data);
      toast({
        title: 'Cart Cleared',
        description: 'All items have been removed',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to clear cart',
        variant: 'destructive'
      });
    }
  };

  const totalSavings = cart.items?.reduce((sum, item) => {
    const savings = (item.product.mrp - item.product.selling_price) * item.quantity;
    return sum + savings;
  }, 0) || 0;

  return (
    <div className="pb-20 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-white p-4 border-b sticky top-0 z-40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate(-1)}
              className="p-2"
              data-testid="back-btn"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Shopping Cart</h1>
              <p className="text-gray-500 text-sm">
                {cart.items?.length || 0} item{cart.items?.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          {cart.items?.length > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={clearCart}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
              data-testid="clear-cart-btn"
            >
              Clear All
            </Button>
          )}
        </div>
      </div>

      {/* Cart Content */}
      <div className="p-4">
        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="p-4 animate-pulse">
                <div className="flex gap-4">
                  <div className="w-20 h-20 bg-gray-200 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="h-4 bg-gray-200 rounded w-1/2" />
                    <div className="h-8 bg-gray-200 rounded w-24" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : cart.items?.length === 0 ? (
          <div className="text-center py-16">
            <ShoppingBag className="w-20 h-20 mx-auto text-gray-300 mb-4" />
            <h3 className="text-xl font-medium text-gray-600">Your cart is empty</h3>
            <p className="text-gray-500 mt-2">Add some products to get started</p>
            <div className="flex gap-3 justify-center mt-6">
              <Button 
                onClick={() => navigate('/medical-equipment')}
                className="bg-orange-500 hover:bg-orange-600"
                data-testid="shop-medical-btn"
              >
                Shop Medical Equipment
              </Button>
              <Button 
                onClick={() => navigate('/personal-care')}
                variant="outline"
                className="border-green-500 text-green-600 hover:bg-green-50"
                data-testid="shop-personal-btn"
              >
                Shop Personal Care
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Cart Items */}
            {cart.items.map(item => (
              <Card 
                key={item.product_id} 
                className="p-4"
                data-testid={`cart-item-${item.product_id}`}
              >
                <div className="flex gap-4">
                  {/* Product Image */}
                  <div className="w-20 h-20 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden">
                    {item.product.image_url ? (
                      <img 
                        src={item.product.image_url}
                        alt={item.product.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = 'https://via.placeholder.com/80x80?text=No+Image';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-8 h-8 text-gray-300" />
                      </div>
                    )}
                  </div>

                  {/* Product Details */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 line-clamp-2">
                      {item.product.name}
                    </h3>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="font-bold text-gray-900">
                        ₹{item.product.selling_price.toLocaleString('en-IN')}
                      </span>
                      {item.product.mrp > item.product.selling_price && (
                        <span className="text-sm text-gray-400 line-through">
                          ₹{item.product.mrp.toLocaleString('en-IN')}
                        </span>
                      )}
                    </div>

                    {/* Quantity Controls */}
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                        <button
                          onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                          disabled={updating === item.product_id || item.quantity <= 1}
                          className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-gray-200 disabled:opacity-50"
                          data-testid={`decrease-qty-${item.product_id}`}
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-8 text-center font-medium">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                          disabled={updating === item.product_id}
                          className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-gray-200 disabled:opacity-50"
                          data-testid={`increase-qty-${item.product_id}`}
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>

                      <button
                        onClick={() => removeItem(item.product_id)}
                        disabled={updating === item.product_id}
                        className="text-red-600 hover:text-red-700 p-2"
                        data-testid={`remove-item-${item.product_id}`}
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Item Total */}
                <div className="flex justify-end mt-3 pt-3 border-t">
                  <span className="text-gray-600">
                    Item Total: <span className="font-bold text-gray-900">₹{item.item_total.toLocaleString('en-IN')}</span>
                  </span>
                </div>
              </Card>
            ))}

            {/* Order Summary */}
            <Card className="p-4 bg-gradient-to-r from-[#E6F4F2] to-[#F0F7E5] border-[#2BA89F]/30">
              <h3 className="font-bold text-gray-900 mb-3">Order Summary</h3>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal ({cart.items?.length} items)</span>
                  <span className="font-medium">₹{cart.total.toLocaleString('en-IN')}</span>
                </div>
                {totalSavings > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Total Savings</span>
                    <span className="font-medium">-₹{totalSavings.toLocaleString('en-IN')}</span>
                  </div>
                )}
                <div className="flex justify-between text-gray-600">
                  <span>Delivery</span>
                  <span className="text-gray-500">To be calculated</span>
                </div>
              </div>

              <div className="flex justify-between items-center mt-4 pt-4 border-t border-emerald-200">
                <span className="text-lg font-bold text-gray-900">Total</span>
                <span className="text-xl font-bold text-emerald-600">
                  ₹{cart.total.toLocaleString('en-IN')}
                </span>
              </div>

              <Button 
                className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white py-6 text-lg"
                onClick={() => navigate('/checkout')}
                data-testid="checkout-btn"
              >
                Proceed to Checkout
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Card>
          </div>
        )}
      </div>

      <BottomNav active="home" />
    </div>
  );
};

export default CartPage;
