import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { invoiceAPI, productAPI, couponAPI, sellerAPI, customerAPI, generateFromMedications } from '../../services/invoiceApi';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Separator } from '../../components/ui/separator';
import { Badge } from '../../components/ui/badge';
import { Switch } from '../../components/ui/switch';
import { Plus, Trash2, Search, User, Tag, ArrowLeft, FileText, Send, X } from 'lucide-react';
import { toast } from 'sonner';

const TAX_RATES = [0, 5, 12, 18, 28];
const INVOICE_TYPES = [
  { value: 'tax_invoice', label: 'Tax Invoice' },
  { value: 'proforma', label: 'Proforma Invoice' },
  { value: 'quotation', label: 'Quotation' },
  { value: 'credit_note', label: 'Credit Note' },
];

const emptyItem = () => ({
  id: Date.now() + Math.random(),
  product_id: null,
  name: '',
  sku: '',
  quantity: 1,
  unit_price: 0,
  gst_rate: 5,
  gst_inclusive: true,
  discount_type: 'percentage',
  discount_value: 0,
});

export default function InvInvoiceCreator() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const [invoiceType, setInvoiceType] = useState('tax_invoice');
  const [invoicePrefix, setInvoicePrefix] = useState('INV');
  const [customer, setCustomer] = useState({ name: '', email: '', phone: '', address: '' });
  const [items, setItems] = useState([emptyItem()]);
  const [globalDiscountType, setGlobalDiscountType] = useState('percentage');
  const [globalDiscountValue, setGlobalDiscountValue] = useState(0);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupons, setAppliedCoupons] = useState([]);
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [activeSearchIdx, setActiveSearchIdx] = useState(-1);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState([]);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const searchTimeout = useRef(null);

  // Load from medications if userId is in URL
  useEffect(() => {
    const userId = searchParams.get('userId');
    if (userId) {
      generateFromMedications(userId).then((res) => {
        const d = res.data;
        if (d.customer_details) setCustomer(d.customer_details);
        if (d.line_items?.length) {
          setItems(d.line_items.map((item, i) => ({ ...emptyItem(), ...item, id: Date.now() + i })));
        }
      }).catch(() => toast.error('Failed to load medication data'));
    }
  }, [searchParams]);

  // Prefill from CRM hand-off (Generate Invoice → navigate with state.prefill)
  // Expected shape: { source, user_id, customer, items: [{name, quantity, unit_price}],
  //                   global_discount_type, global_discount_value }
  useEffect(() => {
    const prefill = location.state?.prefill;
    if (!prefill) return;
    if (prefill.customer) {
      setCustomer({
        name: prefill.customer.name || '',
        email: prefill.customer.email || '',
        phone: prefill.customer.phone || '',
        address: prefill.customer.address || '',
      });
    }
    if (Array.isArray(prefill.items) && prefill.items.length) {
      setItems(prefill.items.map((it, i) => ({
        ...emptyItem(),
        id: Date.now() + i,
        name: it.name || '',
        quantity: it.quantity || 1,
        unit_price: it.unit_price || 0,
      })));
    }
    if (prefill.global_discount_type) setGlobalDiscountType(prefill.global_discount_type);
    if (typeof prefill.global_discount_value === 'number') {
      setGlobalDiscountValue(prefill.global_discount_value);
    }
    // Clear state so a refresh doesn't re-apply the prefill
    navigate(location.pathname, { replace: true, state: {} });
  }, []); // eslint-disable-line

  // Product search
  const searchProducts = useCallback(async (query, idx) => {
    if (!query || query.length < 2) { setSearchResults([]); return; }
    try {
      const res = await productAPI.list({ search: query, limit: 10 });
      setSearchResults(res.data.products || []);
      setActiveSearchIdx(idx);
    } catch {
      setSearchResults([]);
    }
  }, []);

  const handleProductSearchChange = (idx, value) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, name: value } : it));
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => searchProducts(value, idx), 300);
  };

  const selectProduct = (idx, product) => {
    setItems(prev => prev.map((it, i) => i === idx ? {
      ...it, product_id: product.product_id, name: product.name,
      sku: product.sku || '', unit_price: product.price || it.unit_price,
      gst_rate: product.gst_rate ?? 5, gst_inclusive: product.gst_inclusive ?? false,
    } : it));
    setSearchResults([]);
    setActiveSearchIdx(-1);
  };

  // Customer search
  const searchCustomers = useCallback(async (query) => {
    if (!query || query.length < 2) { setCustomerResults([]); return; }
    try {
      const res = await customerAPI.list(query);
      setCustomerResults(res.data.customers || []);
    } catch {
      setCustomerResults([]);
    }
  }, []);

  const handleCustomerSearch = (value) => {
    setCustomerSearch(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => searchCustomers(value), 300);
  };

  const selectCustomer = (c) => {
    setCustomer({ name: c.name || '', email: c.email || '', phone: c.phone || '', address: c.address || '' });
    setShowCustomerSearch(false);
    setCustomerResults([]);
    setCustomerSearch('');
  };

  // Item calculations
  const calcItemTotal = (item) => {
    let base = item.unit_price;
    if (item.gst_inclusive && item.gst_rate > 0) base = item.unit_price / (1 + item.gst_rate / 100);
    const subtotal = item.quantity * base;
    const discount = item.discount_type === 'percentage'
      ? subtotal * (item.discount_value / 100)
      : item.discount_value;
    const taxable = subtotal - discount;
    const tax = taxable * (item.gst_rate / 100);
    return { subtotal, discount, taxable, tax, total: taxable + tax };
  };

  const updateItem = (idx, field, value) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  };

  const addItem = () => setItems(prev => [...prev, emptyItem()]);
  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));

  // Grand total calculation
  const subtotal = items.reduce((s, it) => s + calcItemTotal(it).subtotal, 0);
  const totalItemDiscount = items.reduce((s, it) => s + calcItemTotal(it).discount, 0);
  const totalTax = items.reduce((s, it) => s + calcItemTotal(it).tax, 0);
  const couponDiscount = appliedCoupons.reduce((s, c) => s + c.discount, 0);
  const globalDiscount = globalDiscountType === 'percentage'
    ? subtotal * (globalDiscountValue / 100)
    : globalDiscountValue;
  const grandTotal = Math.max(0, subtotal - totalItemDiscount - couponDiscount - globalDiscount + totalTax);

  // Apply coupon
  const applyCoupon = async () => {
    if (!couponCode) return;
    if (appliedCoupons.find(c => c.code === couponCode.toUpperCase())) {
      toast.error('Coupon already applied');
      return;
    }
    try {
      const res = await couponAPI.validate({ code: couponCode, order_total: subtotal });
      setAppliedCoupons(prev => [...prev, { code: couponCode.toUpperCase(), discount: res.data.discount_amount }]);
      setCouponCode('');
      toast.success('Coupon applied!');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Invalid coupon');
    }
  };

  const removeCoupon = (code) => {
    setAppliedCoupons(prev => prev.filter(c => c.code !== code));
  };

  // Submit
  const handleSubmit = async () => {
    if (!customer.name) { toast.error('Customer name is required'); return; }
    if (items.length === 0 || !items[0].name) { toast.error('Add at least one item'); return; }
    setLoading(true);
    try {
      const payload = {
        invoice_type: invoiceType,
        invoice_prefix: invoicePrefix,
        customer_details: customer,
        line_items: items.map(it => ({
          product_id: it.product_id,
          name: it.name,
          sku: it.sku,
          quantity: it.quantity,
          unit_price: it.unit_price,
          gst_rate: it.gst_rate,
          gst_inclusive: it.gst_inclusive,
          discount_type: it.discount_type,
          discount_value: it.discount_value,
        })),
        global_discount_type: globalDiscountType,
        global_discount_value: globalDiscountValue,
        coupon_codes: appliedCoupons.map(c => c.code),
        due_date: dueDate,
        notes,
      };
      const res = await invoiceAPI.create(payload);
      toast.success(`Invoice ${res.data.invoice_number} created!`);

      // Auto-update Medicine Invoice Link in Purchase Links if created from Medication page
      const userId = searchParams.get('userId');
      if (userId && res.data.invoice_id && res.data.public_token) {
        try {
          const publicLink = `${window.location.origin}/invoice/${res.data.invoice_id}/${res.data.public_token}`;
          await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/prescription-manager/user/${userId}/purchase-links`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              medicine_invoice_link: publicLink,
              medicine_invoice_amount: res.data.grand_total || 0,
            }),
          });
        } catch (linkErr) {
          console.warn('Failed to auto-update purchase link:', linkErr);
        }
      }

      navigate(`/invoice-manager/invoices/${res.data.invoice_id}`);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to create invoice');
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/invoice-manager/invoices')} data-testid="inv-creator-back">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Create Invoice</h1>
          <p className="text-xs text-gray-500">Fill in details to generate a new invoice</p>
        </div>
      </div>

      {/* Invoice Type & Prefix */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Invoice Type</Label>
              <Select value={invoiceType} onValueChange={setInvoiceType}>
                <SelectTrigger data-testid="inv-type-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INVOICE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Invoice Prefix</Label>
              <Input value={invoicePrefix} onChange={e => setInvoicePrefix(e.target.value)} placeholder="INV" data-testid="inv-prefix-input" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Customer Details */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><User className="w-4 h-4" /> Customer Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Button variant="outline" size="sm" onClick={() => setShowCustomerSearch(!showCustomerSearch)} data-testid="inv-search-customer-btn">
              <Search className="w-3 h-3 mr-1" /> Search Existing
            </Button>
            {showCustomerSearch && (
              <div className="mt-2 p-3 border rounded-lg bg-white shadow-lg relative z-10">
                <Input
                  value={customerSearch}
                  onChange={e => handleCustomerSearch(e.target.value)}
                  placeholder="Search by name, email or phone..."
                  autoFocus
                  data-testid="inv-customer-search-input"
                />
                {customerResults.length > 0 && (
                  <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
                    {customerResults.map((c) => (
                      <button
                        key={c.customer_id || c.email}
                        className="w-full text-left p-2 rounded hover:bg-[#2BA89F]/10 text-sm"
                        onClick={() => selectCustomer(c)}
                      >
                        <span className="font-medium">{c.name}</span>
                        <span className="text-gray-500 ml-2">{c.email} {c.phone}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Name *</Label>
              <Input value={customer.name} onChange={e => setCustomer(prev => ({ ...prev, name: e.target.value }))} data-testid="inv-customer-name" />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={customer.email} onChange={e => setCustomer(prev => ({ ...prev, email: e.target.value }))} data-testid="inv-customer-email" />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={customer.phone} onChange={e => setCustomer(prev => ({ ...prev, phone: e.target.value }))} data-testid="inv-customer-phone" />
            </div>
            <div>
              <Label>Address</Label>
              <Input value={customer.address} onChange={e => setCustomer(prev => ({ ...prev, address: e.target.value }))} data-testid="inv-customer-address" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><FileText className="w-4 h-4" /> Line Items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {items.map((item, idx) => (
            <div key={item.id} className="p-3 border rounded-lg space-y-3 bg-gray-50/50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500">Item {idx + 1}</span>
                {items.length > 1 && (
                  <Button variant="ghost" size="sm" onClick={() => removeItem(idx)} data-testid={`inv-remove-item-${idx}`}>
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                )}
              </div>
              {/* Product search */}
              <div className="relative">
                <Label>Product Name *</Label>
                <Input
                  value={item.name}
                  onChange={e => handleProductSearchChange(idx, e.target.value)}
                  placeholder="Search medicine..."
                  data-testid={`inv-item-name-${idx}`}
                />
                {activeSearchIdx === idx && searchResults.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    {searchResults.map((p) => (
                      <button
                        key={p.product_id}
                        className="w-full text-left p-2 hover:bg-[#2BA89F]/10 text-sm"
                        onClick={() => selectProduct(idx, p)}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <Label>Qty</Label>
                  <Input type="text" inputMode="numeric" value={item.quantity} onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)} data-testid={`inv-item-qty-${idx}`} />
                </div>
                <div>
                  <Label>Unit Price (Rs.)</Label>
                  <Input type="text" inputMode="decimal" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', parseFloat(e.target.value) || 0)} data-testid={`inv-item-price-${idx}`} />
                </div>
                <div>
                  <Label>GST %</Label>
                  <Select value={String(item.gst_rate)} onValueChange={v => updateItem(idx, 'gst_rate', parseFloat(v))}>
                    <SelectTrigger data-testid={`inv-item-gst-${idx}`}><SelectValue /></SelectTrigger>
                    <SelectContent>{TAX_RATES.map(r => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Item Discount</Label>
                  <div className="flex gap-1">
                    <Input type="text" inputMode="decimal" value={item.discount_value} onChange={e => updateItem(idx, 'discount_value', parseFloat(e.target.value) || 0)} className="flex-1" data-testid={`inv-item-discount-${idx}`} />
                    <Select value={item.discount_type} onValueChange={v => updateItem(idx, 'discount_type', v)}>
                      <SelectTrigger className="w-16"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">%</SelectItem>
                        <SelectItem value="fixed">Rs.</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <Switch checked={item.gst_inclusive} onCheckedChange={v => updateItem(idx, 'gst_inclusive', v)} />
                <span className="text-gray-500">GST Inclusive</span>
                <span className="ml-auto font-semibold text-emerald-700">
                  Total: Rs.{calcItemTotal(item).total.toFixed(2)}
                </span>
              </div>
            </div>
          ))}
          <Button variant="outline" onClick={addItem} className="w-full" data-testid="inv-add-item-btn">
            <Plus className="w-4 h-4 mr-1" /> Add Item
          </Button>
        </CardContent>
      </Card>

      {/* Coupons & Discounts */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Tag className="w-4 h-4" /> Discounts & Coupons</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input value={couponCode} onChange={e => setCouponCode(e.target.value.toUpperCase())} placeholder="Coupon code" data-testid="inv-coupon-input" />
            <Button onClick={applyCoupon} variant="outline" data-testid="inv-apply-coupon-btn">Apply</Button>
          </div>
          {appliedCoupons.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {appliedCoupons.map(c => (
                <Badge key={c.code} variant="secondary" className="gap-1">
                  {c.code} (-Rs.{c.discount.toFixed(2)})
                  <button onClick={() => removeCoupon(c.code)}><X className="w-3 h-3" /></button>
                </Badge>
              ))}
            </div>
          )}
          <Separator />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Global Discount Type</Label>
              <Select value={globalDiscountType} onValueChange={setGlobalDiscountType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage (%)</SelectItem>
                  <SelectItem value="fixed">Fixed (Rs.)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Discount Value</Label>
              <Input type="text" inputMode="decimal" value={globalDiscountValue} onChange={e => setGlobalDiscountValue(parseFloat(e.target.value) || 0)} data-testid="inv-global-discount-value" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes & Due Date */}
      <Card>
        <CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label>Due Date</Label>
            <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} data-testid="inv-due-date" />
          </div>
          <div>
            <Label>Notes / Terms</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes..." data-testid="inv-notes" />
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card className="border-emerald-200">
        <CardContent className="pt-4 space-y-2">
          <div className="flex justify-between text-sm"><span>Subtotal</span><span>Rs.{subtotal.toFixed(2)}</span></div>
          {totalItemDiscount > 0 && <div className="flex justify-between text-sm text-red-600"><span>Item Discounts</span><span>-Rs.{totalItemDiscount.toFixed(2)}</span></div>}
          {couponDiscount > 0 && <div className="flex justify-between text-sm text-red-600"><span>Coupon Discount</span><span>-Rs.{couponDiscount.toFixed(2)}</span></div>}
          {globalDiscount > 0 && <div className="flex justify-between text-sm text-red-600"><span>Global Discount</span><span>-Rs.{globalDiscount.toFixed(2)}</span></div>}
          <div className="flex justify-between text-sm"><span>Tax (GST)</span><span>Rs.{totalTax.toFixed(2)}</span></div>
          <Separator />
          <div className="flex justify-between text-lg font-bold text-emerald-800">
            <span>Grand Total</span>
            <span data-testid="inv-grand-total">Rs.{grandTotal.toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3 justify-end">
        <Button variant="outline" onClick={() => navigate('/invoice-manager/invoices')} data-testid="inv-cancel-btn">Cancel</Button>
        <Button onClick={handleSubmit} disabled={loading} className="bg-emerald-700 hover:bg-emerald-800" data-testid="inv-submit-btn">
          <Send className="w-4 h-4 mr-1" /> {loading ? 'Creating...' : 'Create Invoice'}
        </Button>
      </div>
    </div>
  );
}
