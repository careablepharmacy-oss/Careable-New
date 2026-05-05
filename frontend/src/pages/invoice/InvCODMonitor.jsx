import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { monitorAPI, invoiceAPI } from '../../services/invoiceApi';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Truck, CheckCircle2, XCircle, Clock, AlertTriangle, Search, ArrowLeft } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { toast } from 'sonner';

const TRACKING_OPTIONS = [
  { value: 'payment_pending', label: 'Payment Pending', color: 'bg-amber-100 text-amber-700' },
  { value: 'payment_received', label: 'Payment Received', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'returned_without_payment', label: 'Returned', color: 'bg-red-100 text-red-700' },
  { value: 'order_cancelled', label: 'Cancelled', color: 'bg-gray-200 text-gray-600' },
  { value: 'refund_initiated', label: 'Refund', color: 'bg-violet-100 text-violet-700' },
];
const DELIVERY_OPTIONS = [
  { value: 'pending', label: 'Pending' }, { value: 'dispatched', label: 'Dispatched' },
  { value: 'in_transit', label: 'In Transit' }, { value: 'delivered', label: 'Delivered' },
  { value: 'returned', label: 'Returned' },
];
const T_COLORS = ['#f59e0b', '#2BA89F', '#ef4444', '#6b7280', '#8b5cf6'];
const D_COLORS = ['#9ca3af', '#3b82f6', '#8b5cf6', '#2BA89F', '#ef4444'];

export default function InvCODMonitor() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [updating, setUpdating] = useState(null);

  const fetchData = useCallback(async () => {
    try { const res = await monitorAPI.cod(); setData(res.data); } catch { toast.error('Failed to load'); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleUpdate = async (invoiceId, field, value) => {
    setUpdating(invoiceId);
    try { await invoiceAPI.updateTracking(invoiceId, { [field]: value }); await fetchData(); toast.success('Updated'); } catch { toast.error('Failed'); }
    setUpdating(null);
  };

  if (loading) return <div className="flex items-center justify-center min-h-[400px]"><div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-600 border-t-transparent" /></div>;

  const invoices = data?.invoices || [];
  const filtered = invoices.filter(inv => {
    const matchSearch = !search || inv.invoice_number?.toLowerCase().includes(search.toLowerCase()) || inv.customer_details?.name?.toLowerCase().includes(search.toLowerCase());
    const ts = inv.tracking_status || 'payment_pending';
    return matchSearch && (filterStatus === 'all' || ts === filterStatus);
  });
  const trackingStats = data?.tracking_stats || {};
  const deliveryStats = data?.delivery_stats || {};
  const trackingPie = TRACKING_OPTIONS.map(o => ({ name: o.label, value: trackingStats[o.value] || 0 })).filter(d => d.value > 0);
  const deliveryPie = DELIVERY_OPTIONS.map(o => ({ name: o.label, value: deliveryStats[o.value] || 0 })).filter(d => d.value > 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/invoice-manager')} data-testid="cod-back"><ArrowLeft className="w-4 h-4" /></Button>
        <div>
          <h1 className="text-xl font-bold">COD Payment Monitor</h1>
          <p className="text-sm text-gray-500">{data?.total || 0} orders | Rs.{(data?.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {TRACKING_OPTIONS.map(opt => (
          <button key={opt.value} onClick={() => setFilterStatus(filterStatus === opt.value ? 'all' : opt.value)}
            className={`p-2 rounded-lg text-center transition ${filterStatus === opt.value ? 'ring-2 ring-emerald-500' : ''} ${opt.color}`} data-testid={`cod-filter-${opt.value}`}>
            <div className="text-xs font-medium">{opt.label}</div>
            <div className="text-lg font-bold">{trackingStats[opt.value] || 0}</div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card><CardHeader><CardTitle className="text-sm">Payment Status</CardTitle></CardHeader><CardContent>
          {trackingPie.length > 0 ? <ResponsiveContainer width="100%" height={200}><PieChart><Pie data={trackingPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70}>{trackingPie.map((_, i) => <Cell key={i} fill={T_COLORS[i % T_COLORS.length]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer> : <p className="text-center text-gray-400 py-4">No data</p>}
        </CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Delivery Status</CardTitle></CardHeader><CardContent>
          {deliveryPie.length > 0 ? <ResponsiveContainer width="100%" height={200}><PieChart><Pie data={deliveryPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70}>{deliveryPie.map((_, i) => <Cell key={i} fill={D_COLORS[i % D_COLORS.length]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer> : <p className="text-center text-gray-400 py-4">No data</p>}
        </CardContent></Card>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><Input value={search} onChange={e => setSearch(e.target.value)} className="pl-10" placeholder="Search..." data-testid="cod-search" /></div>
        <Select value={filterStatus} onValueChange={setFilterStatus}><SelectTrigger className="w-40" data-testid="cod-status-filter"><SelectValue placeholder="All" /></SelectTrigger><SelectContent><SelectItem value="all">All Status</SelectItem>{TRACKING_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select>
      </div>

      <Card><CardContent className="p-0"><Table>
        <TableHeader><TableRow><TableHead>Invoice #</TableHead><TableHead>Customer</TableHead><TableHead className="hidden sm:table-cell">Date</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Delivery</TableHead><TableHead>Payment</TableHead></TableRow></TableHeader>
        <TableBody>
          {filtered.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-6 text-gray-400">No COD orders</TableCell></TableRow> :
            filtered.map(inv => (
              <TableRow key={inv.invoice_id} data-testid={`cod-row-${inv.invoice_id}`}>
                <TableCell className="font-medium cursor-pointer hover:text-emerald-600" onClick={() => navigate(`/invoice-manager/invoices/${inv.invoice_id}`)}>{inv.invoice_number}</TableCell>
                <TableCell><div className="text-sm">{inv.customer_details?.name}</div><div className="text-xs text-gray-400">{inv.customer_details?.phone}</div></TableCell>
                <TableCell className="hidden sm:table-cell text-sm text-gray-500">{inv.created_at?.slice(0, 10)}</TableCell>
                <TableCell className="text-right font-semibold">Rs.{inv.grand_total?.toFixed(2)}</TableCell>
                <TableCell><Select value={inv.delivery_status || 'pending'} onValueChange={v => handleUpdate(inv.invoice_id, 'delivery_status', v)} disabled={updating === inv.invoice_id}><SelectTrigger className="w-28"><SelectValue /></SelectTrigger><SelectContent>{DELIVERY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></TableCell>
                <TableCell><Select value={inv.tracking_status || 'payment_pending'} onValueChange={v => handleUpdate(inv.invoice_id, 'tracking_status', v)} disabled={updating === inv.invoice_id}><SelectTrigger className="w-32"><SelectValue /></SelectTrigger><SelectContent>{TRACKING_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table></CardContent></Card>
    </div>
  );
}
