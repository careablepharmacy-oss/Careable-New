import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { 
  ChevronLeft,
  Plus,
  Search,
  Edit,
  Trash2,
  Upload,
  Package,
  Filter,
  X,
  Check,
  AlertCircle
} from 'lucide-react';
import apiService from '../services/api';
import { toast } from '../hooks/use-toast';

const ProductManagementPage = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    mrp: '',
    selling_price: '',
    category: 'medical_equipment',
    subcategory: '',
    image_url: '',
    is_active: true
  });

  useEffect(() => {
    fetchProducts();
  }, [categoryFilter]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (categoryFilter) params.append('category', categoryFilter);
      params.append('include_inactive', 'true');
      
      const data = await apiService.get(`/api/admin/products?${params.toString()}`);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const payload = {
        ...formData,
        mrp: parseFloat(formData.mrp),
        selling_price: parseFloat(formData.selling_price)
      };

      if (editingProduct) {
        await apiService.request(`/api/admin/products/${editingProduct.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        toast({
          title: 'Success',
          description: 'Product updated successfully'
        });
      } else {
        await apiService.post('/api/admin/products', payload);
        toast({
          title: 'Success',
          description: 'Product created successfully'
        });
      }

      setShowAddModal(false);
      setEditingProduct(null);
      resetForm();
      fetchProducts();
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save product',
        variant: 'destructive'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (productId, productName) => {
    if (!window.confirm(`Are you sure you want to delete "${productName}"?`)) {
      return;
    }

    try {
      await apiService.request(`/api/admin/products/${productId}`, {
        method: 'DELETE'
      });
      toast({
        title: 'Deleted',
        description: 'Product deleted successfully'
      });
      fetchProducts();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete product',
        variant: 'destructive'
      });
    }
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description || '',
      mrp: product.mrp.toString(),
      selling_price: product.selling_price.toString(),
      category: product.category,
      subcategory: product.subcategory || '',
      image_url: product.image_url || '',
      is_active: product.is_active
    });
    setShowAddModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      mrp: '',
      selling_price: '',
      category: 'medical_equipment',
      subcategory: '',
      image_url: '',
      is_active: true
    });
  };

  const handleBulkUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast({
        title: 'Error',
        description: 'Please upload an Excel file (.xlsx or .xls)',
        variant: 'destructive'
      });
      return;
    }

    setUploadingFile(true);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/admin/products/bulk-upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('session_token') || sessionStorage.getItem('session_token')}`
        },
        body: formData
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || 'Upload failed');
      }

      setUploadResult(result);
      toast({
        title: 'Upload Complete',
        description: `Created: ${result.products_created}, Updated: ${result.products_updated}`
      });
      fetchProducts();
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to upload file',
        variant: 'destructive'
      });
    } finally {
      setUploadingFile(false);
      e.target.value = ''; // Reset file input
    }
  };

  const filteredProducts = products.filter(product => {
    if (!searchTerm) return true;
    return product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
           product.subcategory?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white p-4 border-b sticky top-0 z-40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/prescription-manager')}
              className="p-2"
              data-testid="back-btn"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Product Management</h1>
              <p className="text-gray-500 text-sm">{products.length} total products</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline"
              onClick={() => setShowBulkUpload(true)}
              data-testid="bulk-upload-btn"
            >
              <Upload className="w-4 h-4 mr-2" />
              Bulk Upload
            </Button>
            <Button 
              onClick={() => {
                resetForm();
                setEditingProduct(null);
                setShowAddModal(true);
              }}
              className="bg-emerald-600 hover:bg-emerald-700"
              data-testid="add-product-btn"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Product
            </Button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex gap-3 mt-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
              data-testid="search-input"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-4 py-2 border rounded-md bg-white"
            data-testid="category-filter"
          >
            <option value="">All Categories</option>
            <option value="medical_equipment">Medical Equipment</option>
            <option value="personal_care">Personal Care</option>
          </select>
        </div>
      </div>

      {/* Products List */}
      <div className="p-4">
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Card key={i} className="p-4 animate-pulse">
                <div className="flex gap-4">
                  <div className="w-16 h-16 bg-gray-200 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="h-4 bg-gray-200 rounded w-1/2" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-600">No products found</h3>
            <p className="text-gray-500 text-sm mt-1">Add products or adjust your filters</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredProducts.map(product => (
              <Card 
                key={product.id} 
                className={`p-4 ${!product.is_active ? 'opacity-60 bg-gray-100' : ''}`}
                data-testid={`product-row-${product.id}`}
              >
                <div className="flex gap-4">
                  {/* Product Image */}
                  <div className="w-16 h-16 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden">
                    {product.image_url ? (
                      <img 
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = 'https://via.placeholder.com/64x64?text=No+Image';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-6 h-6 text-gray-300" />
                      </div>
                    )}
                  </div>

                  {/* Product Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium text-gray-900 line-clamp-1">
                          {product.name}
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {product.category === 'medical_equipment' ? 'Medical Equipment' : 'Personal Care'}
                          {product.subcategory && ` • ${product.subcategory}`}
                        </p>
                      </div>
                      {!product.is_active && (
                        <span className="px-2 py-1 bg-red-100 text-red-600 text-xs rounded">
                          Inactive
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="font-bold text-gray-900">
                        ₹{product.selling_price.toLocaleString('en-IN')}
                      </span>
                      <span className="text-sm text-gray-400 line-through">
                        ₹{product.mrp.toLocaleString('en-IN')}
                      </span>
                      {product.discount_percent > 0 && (
                        <span className="text-xs text-green-600 font-medium">
                          {Math.round(product.discount_percent)}% OFF
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(product)}
                      data-testid={`edit-product-${product.id}`}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(product.id, product.name)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      data-testid={`delete-product-${product.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Product Modal */}
      {showAddModal && (
        <div 
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => {
            setShowAddModal(false);
            setEditingProduct(null);
          }}
        >
          <div 
            className="bg-white w-full max-w-lg rounded-xl max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-lg font-bold">
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </h2>
              <button onClick={() => {
                setShowAddModal(false);
                setEditingProduct(null);
              }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <Label>Product Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                  placeholder="Enter product name"
                  data-testid="input-name"
                />
              </div>

              <div>
                <Label>Description</Label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full p-3 border rounded-md"
                  rows={3}
                  placeholder="Enter product description"
                  data-testid="input-description"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>MRP (₹) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.mrp}
                    onChange={(e) => setFormData({...formData, mrp: e.target.value})}
                    required
                    placeholder="0.00"
                    data-testid="input-mrp"
                  />
                </div>
                <div>
                  <Label>Selling Price (₹) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.selling_price}
                    onChange={(e) => setFormData({...formData, selling_price: e.target.value})}
                    required
                    placeholder="0.00"
                    data-testid="input-selling-price"
                  />
                </div>
              </div>

              {formData.mrp && formData.selling_price && (
                <div className="text-sm text-green-600 font-medium">
                  Discount: {Math.round(((parseFloat(formData.mrp) - parseFloat(formData.selling_price)) / parseFloat(formData.mrp)) * 100)}% OFF
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Category *</Label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    className="w-full p-3 border rounded-md"
                    required
                    data-testid="input-category"
                  >
                    <option value="medical_equipment">Medical Equipment</option>
                    <option value="personal_care">Personal Care</option>
                  </select>
                </div>
                <div>
                  <Label>Subcategory</Label>
                  <Input
                    value={formData.subcategory}
                    onChange={(e) => setFormData({...formData, subcategory: e.target.value})}
                    placeholder="e.g., Blood Glucose"
                    data-testid="input-subcategory"
                  />
                </div>
              </div>

              <div>
                <Label>Image URL</Label>
                <Input
                  type="url"
                  value={formData.image_url}
                  onChange={(e) => setFormData({...formData, image_url: e.target.value})}
                  placeholder="https://example.com/image.jpg"
                  data-testid="input-image-url"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                  className="w-4 h-4"
                  data-testid="input-is-active"
                />
                <Label htmlFor="is_active" className="mb-0">Active (visible to customers)</Label>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingProduct(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                  disabled={submitting}
                  data-testid="submit-product-btn"
                >
                  {submitting ? 'Saving...' : editingProduct ? 'Update Product' : 'Add Product'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Upload Modal */}
      {showBulkUpload && (
        <div 
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => {
            setShowBulkUpload(false);
            setUploadResult(null);
          }}
        >
          <div 
            className="bg-white w-full max-w-lg rounded-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-bold">Bulk Upload Products</h2>
              <button onClick={() => {
                setShowBulkUpload(false);
                setUploadResult(null);
              }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-medium text-blue-900 mb-2">Excel File Format</h3>
                <p className="text-sm text-blue-700 mb-2">
                  Upload an Excel file (.xlsx) with the following columns:
                </p>
                <ul className="text-sm text-blue-600 list-disc list-inside space-y-1">
                  <li><strong>name</strong> (required)</li>
                  <li><strong>description</strong></li>
                  <li><strong>mrp</strong> (required)</li>
                  <li><strong>selling_price</strong> (required)</li>
                  <li><strong>discount_percent</strong> (auto-calculated if empty)</li>
                  <li><strong>category</strong> (required: medical_equipment or personal_care)</li>
                  <li><strong>subcategory</strong></li>
                  <li><strong>image_url</strong></li>
                </ul>
              </div>

              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <Upload className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                <p className="text-gray-600 mb-3">
                  {uploadingFile ? 'Uploading...' : 'Click to select or drag and drop'}
                </p>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleBulkUpload}
                  disabled={uploadingFile}
                  className="hidden"
                  id="bulk-upload-input"
                  data-testid="bulk-upload-input"
                />
                <label htmlFor="bulk-upload-input">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={uploadingFile}
                    className="cursor-pointer"
                    asChild
                  >
                    <span>{uploadingFile ? 'Uploading...' : 'Select Excel File'}</span>
                  </Button>
                </label>
              </div>

              {uploadResult && (
                <div className={`rounded-lg p-4 ${
                  uploadResult.errors?.length > 0 
                    ? 'bg-yellow-50 border border-yellow-200' 
                    : 'bg-green-50 border border-green-200'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {uploadResult.errors?.length > 0 ? (
                      <AlertCircle className="w-5 h-5 text-yellow-600" />
                    ) : (
                      <Check className="w-5 h-5 text-green-600" />
                    )}
                    <span className="font-medium">Upload Complete</span>
                  </div>
                  <p className="text-sm">
                    Products Created: <strong>{uploadResult.products_created}</strong>
                  </p>
                  <p className="text-sm">
                    Products Updated: <strong>{uploadResult.products_updated}</strong>
                  </p>
                  {uploadResult.errors?.length > 0 && (
                    <div className="mt-2">
                      <p className="text-sm font-medium text-yellow-700">Errors:</p>
                      <ul className="text-xs text-yellow-600 list-disc list-inside max-h-32 overflow-y-auto">
                        {uploadResult.errors.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductManagementPage;
