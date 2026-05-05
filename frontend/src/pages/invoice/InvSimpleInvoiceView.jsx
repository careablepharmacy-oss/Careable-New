import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { invoiceAPI, paymentAPI } from '../../services/invoiceApi';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { ShieldCheck, Truck, CreditCard, CheckCircle2, Package } from 'lucide-react';
import { toast } from 'sonner';

export default function InvSimpleInvoiceView({ isPublicView }) {
  const { invoiceId, token } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [payDialog, setPayDialog] = useState(false);
  const [payMethod, setPayMethod] = useState(null);
  const [paying, setPaying] = useState(false);
  const [codConfirmed, setCodConfirmed] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        let res;
        if (isPublicView && token) {
          res = await invoiceAPI.getPublic(invoiceId, token);
        } else {
          res = await invoiceAPI.get(invoiceId);
        }
        setInvoice(res.data);
      } catch {
        toast.error('Invoice not found');
      }
      setLoading(false);
    })();
  }, [invoiceId, token, isPublicView]);

  const handleOnlinePayment = async () => {
    setPaying(true);
    try {
      const orderRes = await paymentAPI.createOrder({ invoice_id: invoice.invoice_id });
      await paymentAPI.verify({ payment_id: orderRes.data.payment_id, invoice_id: invoice.invoice_id, payment_method: 'online' });
      setInvoice(prev => ({ ...prev, payment_status: 'paid', payment_method: 'online' }));
      setPayDialog(false); setPayMethod(null);
      toast.success('Payment successful!');
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
    } catch { toast.error('Failed to confirm order'); }
    setPaying(false);
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-600 border-t-transparent" /></div>;
  if (!invoice) return <div className="flex items-center justify-center min-h-screen text-gray-400">Invoice not found</div>;

  const s = invoice.seller_details || {};
  const c = invoice.customer_details || {};

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-6 px-4">
      <div className="max-w-md mx-auto space-y-4">
        {/* Payment CTA */}
        {invoice.payment_status !== 'paid' && (
          <button
            onClick={() => { setPayDialog(true); setPayMethod(null); setCodConfirmed(false); }}
            className="w-full py-4 px-6 rounded-2xl text-lg font-bold text-white shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #059669 0%, #047857 100%)' }}
            data-testid="simple-confirm-payment-btn"
          >
            <ShieldCheck className="w-5 h-5 inline mr-2" />
            Confirm and Make Payment
            <span className="block text-sm font-normal opacity-80 mt-1">Rs.{invoice.grand_total?.toFixed(2)} due</span>
          </button>
        )}

        {/* Invoice Card */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="p-6 border-b bg-[#E6F4F2]">
            <h2 className="text-lg font-bold text-gray-900">{s.business_name || 'Invoice'}</h2>
            <div className="flex justify-between items-center mt-1">
              <span className="text-sm text-gray-500">#{invoice.invoice_number}</span>
              <Badge className={invoice.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}>
                {invoice.payment_status?.toUpperCase()}
              </Badge>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <p className="text-xs text-gray-400 font-semibold">Bill To</p>
              <p className="font-medium">{c.name}</p>
              {c.phone && <p className="text-sm text-gray-500">{c.phone}</p>}
            </div>

            <table className="w-full text-sm">
              <thead><tr className="border-b"><th className="text-left py-2 text-gray-500">#</th><th className="text-left py-2 text-gray-500">Item</th><th className="text-right py-2 text-gray-500">Qty</th></tr></thead>
              <tbody>
                {invoice.line_items?.map((item, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 text-gray-400">{i + 1}</td>
                    <td className="py-2">{item.name}</td>
                    <td className="py-2 text-right">{item.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-between items-center pt-3 border-t">
              <span className="font-semibold text-gray-700">Total Amount</span>
              <span className="text-xl font-bold text-emerald-700">Rs.{invoice.grand_total?.toFixed(2)}</span>
            </div>

            {invoice.payment_status === 'paid' && (
              <div className="text-center p-4 bg-[#E6F4F2] rounded-xl space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-1" />
                <p className="font-semibold text-emerald-700">Order Completed</p>
                {invoice.payment_method && (
                  <p className="text-xs text-gray-500">
                    {invoice.payment_method === 'cod' ? 'Cash on Delivery' : 'Online'}
                  </p>
                )}
                {invoice.payment_method === 'cod' && (
                  <p className="text-xs text-amber-700 font-medium">
                    Please make the payment on delivery.
                  </p>
                )}
                <Button
                  onClick={() => navigate('/orders')}
                  className="mt-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                  data-testid="track-order-now-btn"
                >
                  <Truck className="w-4 h-4 mr-2" />
                  Track Order Now
                </Button>
              </div>
            )}
          </div>

          <div className="p-3 bg-gray-50 text-center text-xs text-gray-400">
            Powered by {s.business_name || 'Careable 360+'}
          </div>
        </div>

        {/* Payment Dialogs */}
        <Dialog open={payDialog && !payMethod} onOpenChange={open => { if (!open) setPayDialog(false); }}>
          <DialogContent><DialogHeader><DialogTitle>Complete Payment</DialogTitle></DialogHeader>
            <p className="text-center text-2xl font-bold text-emerald-700 my-3">Rs.{invoice?.grand_total?.toFixed(2)}</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setPayMethod('cod')} className="p-4 border-2 rounded-xl hover:border-emerald-400 text-center" data-testid="simple-pay-cod-option">
                <Package className="w-8 h-8 mx-auto text-emerald-600 mb-2" /><p className="font-semibold text-sm">Cash on Delivery</p>
              </button>
              <button onClick={() => setPayMethod('online')} className="p-4 border-2 rounded-xl hover:border-emerald-400 text-center" data-testid="simple-pay-online-option">
                <CreditCard className="w-8 h-8 mx-auto text-emerald-600 mb-2" /><p className="font-semibold text-sm">Pay Online</p>
              </button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={payMethod === 'online'} onOpenChange={open => { if (!open) { setPayDialog(false); setPayMethod(null); }}}>
          <DialogContent><DialogHeader><DialogTitle>Pay Online</DialogTitle></DialogHeader>
            <p className="text-center text-lg my-2">Rs.{invoice?.grand_total?.toFixed(2)}</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPayMethod(null)}>Back</Button>
              <Button onClick={handleOnlinePayment} disabled={paying} className="bg-emerald-700 hover:bg-emerald-800">{paying ? 'Processing...' : 'Proceed to Pay'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={payMethod === 'cod' && !codConfirmed} onOpenChange={open => { if (!open) { setPayDialog(false); setPayMethod(null); }}}>
          <DialogContent><DialogHeader><DialogTitle>Cash on Delivery</DialogTitle></DialogHeader>
            <p className="text-center text-lg my-2">Rs.{invoice?.grand_total?.toFixed(2)}</p>
            <p className="text-sm text-gray-500 text-center">Pay when your order is delivered.</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPayMethod(null)}>Back</Button>
              <Button onClick={handleCOD} disabled={paying} className="bg-emerald-700 hover:bg-emerald-800">{paying ? 'Confirming...' : 'Confirm COD'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={codConfirmed} onOpenChange={open => { if (!open) { setCodConfirmed(false); setPayDialog(false); setPayMethod(null); }}}>
          <DialogContent>
            <div className="text-center py-4">
              <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-3" />
              <h3 className="text-lg font-bold">Order Confirmed!</h3>
              <p className="text-sm text-gray-500">Rs.{invoice?.grand_total?.toFixed(2)} will be collected on delivery.</p>
            </div>
            <DialogFooter>
              <Button onClick={() => { setCodConfirmed(false); setPayDialog(false); setPayMethod(null); }} className="bg-emerald-700 hover:bg-emerald-800" data-testid="simple-cod-success-close">Done</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
