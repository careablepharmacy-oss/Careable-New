import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { 
  Search, 
  ShoppingCart, 
  ChevronLeft,
  Heart,
  X,
  Package
} from 'lucide-react';
import BottomNav from '../components/BottomNav';
import apiService from '../services/api';
import { toast } from '../hooks/use-toast';

const MedicalEquipmentPage = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubcategory, setSelectedSubcategory] = useState('');
  const [subcategories, setSubcategories] = useState([]);
  const [cartCount, setCartCount] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [addingToCart, setAddingToCart] = useState(null);
  const [sortBy, setSortBy] = useState('name_asc');

  useEffect(() => {
    fetchProducts();
    fetchSubcategories();
    fetchCartCount();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const data = await apiService.get('/api/products?category=medical_equipment');
      setProducts(data);
    } catch (error) {
      console.error('Failed to fetch products:', error);
      toast({
        title: 'Error',
        description: 'Failed to load products',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchSubcategories = async () => {
    try {
      const data = await apiService.get('/api/products/subcategories?category=medical_equipment');
      setSubcategories(data);
    } catch (error) {
      console.error('Failed to fetch subcategories:', error);
    }
  };

  const fetchCartCount = async () => {
    try {
      const cart = await apiService.get('/api/cart');
      const count = cart.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
      setCartCount(count);
    } catch (error) {
      console.error('Failed to fetch cart:', error);
    }
  };

  const handleAddToCart = async (product, e) => {
    e?.stopPropagation();
    setAddingToCart(product.id);
    try {
      const result = await apiService.post('/api/cart/add', {
        product_id: product.id,
        quantity: 1
      });
      // Update cart count from the actual response
      const count = result.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
      setCartCount(count);
      toast({
        title: 'Added to Cart',
        description: `${product.name} added to your cart`,
      });
    } catch (error) {
      console.error('Add to cart error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to add to cart',
        variant: 'destructive'
      });
    } finally {
      setAddingToCart(null);
    }
  };

  const filteredProducts = useMemo(() => {
    const filtered = products.filter(product => {
      const matchesSearch = !searchTerm || 
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.description?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesSubcategory = !selectedSubcategory || 
        product.subcategory === selectedSubcategory;
      
      return matchesSearch && matchesSubcategory;
    });

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'price_asc':
          return a.selling_price - b.selling_price;
        case 'price_desc':
          return b.selling_price - a.selling_price;
        case 'discount':
          return (b.discount_percent || 0) - (a.discount_percent || 0);
        case 'name_asc':
        default:
          return a.name.localeCompare(b.name);
      }
    });
  }, [products, searchTerm, selectedSubcategory, sortBy]);

  return (
    <div className="pb-20 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-red-500 p-4 sticky top-0 z-40">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/home')}
              className="text-white hover:bg-white/20 p-2"
              data-testid="back-btn"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-white">Medical Equipment</h1>
              <p className="text-orange-100 text-xs">{filteredProducts.length} products</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/cart')}
            className="text-white hover:bg-white/20 relative"
            data-testid="cart-btn"
          >
            <ShoppingCart className="w-6 h-6" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-yellow-400 text-gray-900 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </Button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <Input
            placeholder="Search medical equipment..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-10 bg-white/95 border-0 rounded-xl"
            data-testid="search-input"
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Subcategory Filters */}
      {subcategories.length > 0 && (
        <div className="p-3 bg-white border-b overflow-x-auto">
          <div className="flex gap-2 min-w-max">
            <button
              onClick={() => setSelectedSubcategory('')}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                !selectedSubcategory 
                  ? 'bg-orange-500 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              data-testid="filter-all"
            >
              All
            </button>
            {subcategories.map(sub => (
              <button
                key={sub}
                onClick={() => setSelectedSubcategory(sub)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  selectedSubcategory === sub 
                    ? 'bg-orange-500 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                data-testid={`filter-${sub}`}
              >
                {sub}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sort Bar */}
      <div className="px-3 pt-3 pb-1 bg-gray-50">
        <div className="flex items-center gap-2 overflow-x-auto">
          {[
            { key: 'name_asc', label: 'A–Z' },
            { key: 'price_asc', label: 'Price: Low–High' },
            { key: 'price_desc', label: 'Price: High–Low' },
            { key: 'discount', label: 'Discount' },
          ].map(opt => (
            <button
              key={opt.key}
              onClick={() => setSortBy(opt.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                sortBy === opt.key
                  ? 'bg-orange-500 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
              }`}
              data-testid={`sort-${opt.key}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      <div className="p-3">
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <div className="aspect-square bg-gray-200 rounded-t-lg" />
                <div className="p-3 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                  <div className="h-8 bg-gray-200 rounded" />
                </div>
              </Card>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-600">No products found</h3>
            <p className="text-gray-500 text-sm mt-1">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filteredProducts.map(product => (
              <Card 
                key={product.id} 
                className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => setSelectedProduct(product)}
                data-testid={`product-card-${product.id}`}
              >
                {/* Product Image */}
                <div className="aspect-square bg-gray-100 relative">
                  {product.image_url ? (
                    <img 
                      src={product.image_url} 
                      alt={product.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = 'https://via.placeholder.com/200x200?text=No+Image';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Heart className="w-12 h-12 text-gray-300" />
                    </div>
                  )}
                  {product.discount_percent > 0 && (
                    <span className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">
                      {Math.round(product.discount_percent)}% OFF
                    </span>
                  )}
                </div>

                {/* Product Info */}
                <div className="p-3">
                  <h3 className="font-medium text-gray-900 text-sm line-clamp-2 min-h-[2.5rem]">
                    {product.name}
                  </h3>
                  {product.subcategory && (
                    <p className="text-xs text-gray-500 mt-1">{product.subcategory}</p>
                  )}
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-lg font-bold text-orange-600">
                      ₹{product.selling_price.toLocaleString('en-IN')}
                    </span>
                    {product.mrp > product.selling_price && (
                      <span className="text-sm text-gray-400 line-through">
                        ₹{product.mrp.toLocaleString('en-IN')}
                      </span>
                    )}
                  </div>
                  <Button 
                    className="w-full mt-3 bg-orange-500 hover:bg-orange-600 text-white"
                    size="sm"
                    onClick={(e) => handleAddToCart(product, e)}
                    disabled={addingToCart === product.id}
                    data-testid={`add-to-cart-${product.id}`}
                  >
                    {addingToCart === product.id ? 'Adding...' : 'Add to Cart'}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Product Detail Modal */}
      {selectedProduct && (
        <div 
          className="fixed inset-0 bg-black/50 z-[9999] flex items-end justify-center"
          onClick={() => setSelectedProduct(null)}
        >
          <div 
            className="bg-white w-full max-w-lg rounded-t-3xl flex flex-col"
            style={{ maxHeight: 'calc(85vh - env(safe-area-inset-bottom, 0px))' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Scrollable Content */}
            <div className="overflow-y-auto flex-1 min-h-0">
              {/* Product Image */}
              <div className="aspect-video bg-gray-100 relative flex-shrink-0">
                {selectedProduct.image_url ? (
                  <img 
                    src={selectedProduct.image_url} 
                    alt={selectedProduct.name}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Heart className="w-20 h-20 text-gray-300" />
                  </div>
                )}
                <button 
                  onClick={() => setSelectedProduct(null)}
                  className="absolute top-4 right-4 bg-white/90 rounded-full p-2"
                >
                  <X className="w-5 h-5" />
                </button>
                {selectedProduct.discount_percent > 0 && (
                  <span className="absolute top-4 left-4 bg-red-500 text-white text-sm font-bold px-3 py-1 rounded-full">
                    {Math.round(selectedProduct.discount_percent)}% OFF
                  </span>
                )}
              </div>

              {/* Product Details */}
              <div className="p-5">
                {selectedProduct.subcategory && (
                  <p className="text-sm text-orange-600 font-medium">{selectedProduct.subcategory}</p>
                )}
                <h2 className="text-xl font-bold text-gray-900 mt-1">{selectedProduct.name}</h2>
                
                <div className="flex items-baseline gap-3 mt-3">
                  <span className="text-2xl font-bold text-orange-600">
                    ₹{selectedProduct.selling_price.toLocaleString('en-IN')}
                  </span>
                  {selectedProduct.mrp > selectedProduct.selling_price && (
                    <>
                      <span className="text-lg text-gray-400 line-through">
                        ₹{selectedProduct.mrp.toLocaleString('en-IN')}
                      </span>
                      <span className="text-green-600 font-medium">
                        Save ₹{(selectedProduct.mrp - selectedProduct.selling_price).toLocaleString('en-IN')}
                      </span>
                    </>
                  )}
                </div>

                {selectedProduct.description && (
                  <div className="mt-4">
                    <h3 className="font-medium text-gray-900">Description</h3>
                    <p className="text-gray-600 text-sm mt-1">{selectedProduct.description}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Fixed Bottom Button - Always visible */}
            <div className="p-5 border-t bg-white flex-shrink-0" style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))' }}>
              <Button 
                className="w-full bg-orange-500 hover:bg-orange-600 text-white py-6 text-lg"
                onClick={(e) => {
                  handleAddToCart(selectedProduct, e);
                  setSelectedProduct(null);
                }}
                disabled={addingToCart === selectedProduct.id}
                data-testid="modal-add-to-cart"
              >
                <ShoppingCart className="w-5 h-5 mr-2" />
                {addingToCart === selectedProduct.id ? 'Adding...' : 'Add to Cart'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <BottomNav active="home" />
    </div>
  );
};

export default MedicalEquipmentPage;
