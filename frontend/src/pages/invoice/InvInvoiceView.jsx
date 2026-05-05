import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { invoiceAPI, paymentAPI, sellerAPI } from '../../services/invoiceApi';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent } from '../../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { ArrowLeft, Send, Printer, Truck, CreditCard, CheckCircle2, Package, Copy } from 'lucide-react';
import { toast } from 'sonner';

const DELIVERY_OPTIONS = [
  { value: 'pending', label: 'Pending', color: 'bg-gray-100 text-gray-600' },
  { value: 'dispatched', label: 'Dispatched', color: 'bg-blue-100 text-blue-700' },
  { value: 'in_transit', label: 'In Transit', color: 'bg-purple-100 text-purple-700' },
  { value: 'delivered', label: 'Delivered', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'returned', label: 'Returned', color: 'bg-red-100 text-red-700' },
];

export default function InvInvoiceView() {
  const { invoiceId } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [payDialog, setPayDialog] = useState(false);
  const [payMethod, setPayMethod] = useState(null);
  const [paying, setPaying] = useState(false);
  const [codConfirmed, setCodConfirmed] = useState(false);

  useEffect(() => {
    invoiceAPI.get(invoiceId).then(r => setInvoice(r.data)).catch(() => toast.error('Invoice not found')).finally(() => setLoading(false));
  }, [invoiceId]);

  const handlePrint = () => window.print();

  const copyShareLink = () => {
    if (!invoice?.public_token) return;
    const url = `${window.location.origin}/invoice/${invoice.invoice_id}/${invoice.public_token}`;
    navigator.clipboard.writeText(url);
    toast.success('Share link copied!');
  };

  const handleDeliveryUpdate = async (value) => {
    try {
      const res = await invoiceAPI.updateTracking(invoiceId, { delivery_status: value });
      setInvoice(res.data);
      toast.success('Delivery status updated');
    } catch {
      toast.error('Update failed');
    }
  };

  const handleOnlinePayment = async () => {
    setPaying(true);
    try {
      const orderRes = await paymentAPI.createOrder({ invoice_id: invoice.invoice_id });
      await paymentAPI.verify({ payment_id: orderRes.data.payment_id, invoice_id: invoice.invoice_id, payment_method: 'online' });
      setInvoice(prev => ({ ...prev, payment_status: 'paid', payment_method: 'online' }));
      setPayDialog(false); setPayMethod(null);
      toast.success('Payment recorded!');
    } catch { toast.error('Payment failed'); }
    setPaying(false);
  };

  const handleCOD = async () => {
    setPaying(true);
    try {
      const orderRes = await paymentAPI.createOrder({ invoice_id: invoice.invoice_id });
      await paymentAPI.verify({ payment_id: orderRes.data.payment_id, invoice_id: invoice.invoice_id, payment_method: 'cod' });
      setInvoice(prev => ({ ...prev, payment_status: 'paid', payment_method: 'cod' }));
      setCodConfirmed(true);
    } catch { toast.error('Failed to confirm'); }
    setPaying(false);
  };

  if (loading) return <div className="flex items-center justify-center min-h-[400px]"><div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-600 border-t-transparent" /></div>;
  if (!invoice) return <div className="text-center py-8 text-gray-400">Invoice not found</div>;

  const s = invoice.seller_details || {};
  const c = invoice.customer_details || {};
  const ds = invoice.delivery_status || 'pending';
  const dsInfo = DELIVERY_OPTIONS.find(o => o.value === ds) || DELIVERY_OPTIONS[0];

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/invoice-manager/invoices')} data-testid="inv-view-back"><ArrowLeft className="w-4 h-4" /></Button>
          <div>
            <h1 className="text-xl font-bold">{invoice.invoice_number}</h1>
            <p className="text-xs text-gray-500">{invoice.invoice_type?.replace('_', ' ')}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={copyShareLink} data-testid="inv-copy-link"><Copy className="w-4 h-4 mr-1" />Share Link</Button>
          <Button variant="outline" size="sm" onClick={handlePrint} data-testid="inv-print"><Printer className="w-4 h-4 mr-1" />Print</Button>
          {invoice.payment_status !== 'paid' && (
            <Button size="sm" className="bg-emerald-700 hover:bg-emerald-800" onClick={() => { setPayDialog(true); setPayMethod(null); setCodConfirmed(false); }} data-testid="inv-pay-btn">
              <CreditCard className="w-4 h-4 mr-1" />Record Payment
            </Button>
          )}
        </div>
      </div>

      {/* Status badges */}
      <div className="flex flex-wrap gap-2 print:hidden">
        <Badge className={invoice.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}>
          {invoice.payment_status}
        </Badge>
        {invoice.payment_method && <Badge variant="outline">{invoice.payment_method === 'cod' ? 'COD' : 'Online'}</Badge>}
        <Badge className={dsInfo.color}>{dsInfo.label}</Badge>
      </div>

      {/* Delivery Status Selector */}
      <div className="print:hidden">
        <div className="flex items-center gap-3">
          <Truck className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-600">Delivery:</span>
          <Select value={ds} onValueChange={handleDeliveryUpdate}>
            <SelectTrigger className="w-40" data-testid="inv-delivery-select"><SelectValue /></SelectTrigger>
            <SelectContent>
              {DELIVERY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Invoice Card */}
      <Card>
        <CardContent className="pt-6 space-y-6">
          {/* Seller & Customer Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-400 mb-1">FROM</h3>
              <p className="font-bold text-gray-900">{s.business_name || 'Your Business'}</p>
              {s.address && <p className="text-sm text-gray-600">{s.address}</p>}
              {s.phone && <p className="text-sm text-gray-600">{s.phone}</p>}
              {s.gst_number && <p className="text-xs text-gray-500">GST: {s.gst_number}</p>}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-400 mb-1">BILL TO</h3>
              <p className="font-bold text-gray-900">{c.name}</p>
              {c.email && <p className="text-sm text-gray-600">{c.email}</p>}
              {c.phone && <p className="text-sm text-gray-600">{c.phone}</p>}
              {c.address && <p className="text-sm text-gray-600">{c.address}</p>}
            </div>
          </div>

          {/* Meta */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div><span className="text-gray-500">Invoice #</span><p className="font-medium">{invoice.invoice_number}</p></div>
            <div><span className="text-gray-500">Date</span><p className="font-medium">{invoice.created_at?.slice(0, 10)}</p></div>
            <div><span className="text-gray-500">Due Date</span><p className="font-medium">{invoice.due_date}</p></div>
            <div><span className="text-gray-500">Type</span><p className="font-medium capitalize">{invoice.invoice_type?.replace('_', ' ')}</p></div>
          </div>

          {/* Items Table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Item</TableHead>
                <TableHead className="text-center">Qty</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Tax</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.line_items?.map((item, i) => (
                <TableRow key={i}>
                  <TableCell className="text-gray-500">{i + 1}</TableCell>
                  <TableCell className="font-medium">{item.name}{item.sku ? <span className="text-xs text-gray-400 ml-1">({item.sku})</span> : ''}</TableCell>
                  <TableCell className="text-center">{item.quantity}</TableCell>
                  <TableCell className="text-right">Rs.{item.unit_price?.toFixed(2)}</TableCell>
                  <TableCell className="text-right text-gray-500">Rs.{item.tax_amount?.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-semibold">Rs.{item.item_total?.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-64 space-y-1 text-sm">
              <div className="flex justify-between"><span>Subtotal</span><span>Rs.{invoice.subtotal?.toFixed(2)}</span></div>
              {invoice.total_discount > 0 && <div className="flex justify-between text-red-600"><span>Discount</span><span>-Rs.{invoice.total_discount?.toFixed(2)}</span></div>}
              <div className="flex justify-between"><span>Tax</span><span>Rs.{invoice.total_tax?.toFixed(2)}</span></div>
              <div className="flex justify-between font-bold text-lg border-t pt-1"><span>Total</span><span className="text-emerald-700">Rs.{invoice.grand_total?.toFixed(2)}</span></div>
            </div>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs font-medium text-gray-500">Notes / Terms</p>
              <p className="text-sm text-gray-700">{invoice.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Method Selection Dialog */}
      <Dialog open={payDialog && !payMethod} onOpenChange={open => { if (!open) setPayDialog(false); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
          <p className="text-center text-2xl font-bold text-emerald-700 my-3">Rs.{invoice.grand_total?.toFixed(2)}</p>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setPayMethod('cod')} className="p-4 border-2 rounded-xl hover:border-emerald-400 hover:bg-[#2BA89F]/10 transition text-center" data-testid="inv-pay-cod">
              <Package className="w-8 h-8 mx-auto text-emerald-600 mb-2" />
              <p className="font-semibold">Cash on Delivery</p>
            </button>
            <button onClick={() => setPayMethod('online')} className="p-4 border-2 rounded-xl hover:border-emerald-400 hover:bg-[#2BA89F]/10 transition text-center" data-testid="inv-pay-online">
              <CreditCard className="w-8 h-8 mx-auto text-emerald-600 mb-2" />
              <p className="font-semibold">Online Payment</p>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Online Payment Dialog */}
      <Dialog open={payMethod === 'online'} onOpenChange={open => { if (!open) { setPayDialog(false); setPayMethod(null); }}}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Online Payment</DialogTitle></DialogHeader>
          <p className="text-center text-lg my-2">Rs.{invoice.grand_total?.toFixed(2)}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayMethod(null)}>Back</Button>
            <Button onClick={handleOnlinePayment} disabled={paying} className="bg-emerald-700 hover:bg-emerald-800" data-testid="inv-confirm-online-pay">
              {paying ? 'Processing...' : 'Record Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* COD Dialog */}
      <Dialog open={payMethod === 'cod' && !codConfirmed} onOpenChange={open => { if (!open) { setPayDialog(false); setPayMethod(null); }}}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cash on Delivery</DialogTitle></DialogHeader>
          <p className="text-center text-lg my-2">Rs.{invoice.grand_total?.toFixed(2)}</p>
          <p className="text-sm text-gray-500 text-center">Payment will be collected on delivery.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayMethod(null)}>Back</Button>
            <Button onClick={handleCOD} disabled={paying} className="bg-emerald-700 hover:bg-emerald-800" data-testid="inv-confirm-cod-pay">
              {paying ? 'Confirming...' : 'Confirm COD Order'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* COD Success */}
      <Dialog open={codConfirmed} onOpenChange={open => { if (!open) { setCodConfirmed(false); setPayDialog(false); setPayMethod(null); }}}>
        <DialogContent>
          <div className="text-center py-4">
            <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-3" />
            <h3 className="text-lg font-bold">Order Confirmed!</h3>
            <p className="text-sm text-gray-500 mt-1">Payment of Rs.{invoice.grand_total?.toFixed(2)} via COD</p>
          </div>
          <DialogFooter>
            <Button onClick={() => { setCodConfirmed(false); setPayDialog(false); setPayMethod(null); }} className="bg-emerald-700 hover:bg-emerald-800" data-testid="inv-cod-success-close">Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
