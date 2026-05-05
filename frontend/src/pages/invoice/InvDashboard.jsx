import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { analyticsAPI, invoiceAPI } from '../../services/invoiceApi';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { FileText, Package, Tag, TrendingUp, IndianRupee, PlusCircle, Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { toast } from 'sonner';

const PIE_COLORS = ['#059669', '#3b82f6', '#f59e0b', '#ef4444'];

export default function InvDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await analyticsAPI.dashboard();
      setData(res.data);
    } catch {
      toast.error('Failed to load dashboard');
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleExportCSV = async () => {
    try {
      const res = await invoiceAPI.exportCSV();
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'invoices_export.csv';
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('CSV exported');
    } catch {
      toast.error('Export failed');
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-[400px]"><div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-600 border-t-transparent" /></div>;

  const d = data || {};
  const paymentPie = Object.entries(d.payment_methods || {}).map(([key, val]) => ({
    name: key === 'cod' ? 'Cash on Delivery' : 'Online',
    value: val.amount || 0
  })).filter(p => p.value > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" data-testid="inv-dashboard-title">Revenue Dashboard</h1>
          <p className="text-sm text-gray-500">Invoice & delivery overview</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleExportCSV} variant="outline" size="sm" data-testid="inv-export-csv-btn">
            <Download className="w-4 h-4 mr-1" /> Export CSV
          </Button>
          <Button onClick={() => navigate('/invoice-manager/invoices/create')} size="sm" className="bg-emerald-700 hover:bg-emerald-800" data-testid="inv-create-invoice-btn">
            <PlusCircle className="w-4 h-4 mr-1" /> New Invoice
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#2BA89F]/10"><IndianRupee className="w-5 h-5 text-[#1E3A5F]" /></div>
            <div><p className="text-xs text-gray-500">Total Revenue</p><p className="text-lg font-bold" data-testid="inv-total-revenue">Rs.{(d.total_revenue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p></div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50"><FileText className="w-5 h-5 text-blue-600" /></div>
            <div><p className="text-xs text-gray-500">Invoices</p><p className="text-lg font-bold" data-testid="inv-total-invoices">{d.total_invoices || 0}</p></div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-50"><Package className="w-5 h-5 text-amber-600" /></div>
            <div><p className="text-xs text-gray-500">Medicines</p><p className="text-lg font-bold">{d.total_products || 0}</p></div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-50"><Tag className="w-5 h-5 text-purple-600" /></div>
            <div><p className="text-xs text-gray-500">Coupons</p><p className="text-lg font-bold">{d.total_coupons || 0}</p></div>
          </div>
        </CardContent></Card>
      </div>

      {/* Revenue Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="border-[#2BA89F]/30 bg-[#E6F4F2]/60"><CardContent className="pt-4">
          <p className="text-sm text-emerald-700">Paid Revenue</p>
          <p className="text-2xl font-bold text-emerald-800">Rs.{(d.paid_revenue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
        </CardContent></Card>
        <Card className="border-amber-200 bg-amber-50/50"><CardContent className="pt-4">
          <p className="text-sm text-amber-700">Unpaid Revenue</p>
          <p className="text-2xl font-bold text-amber-800">Rs.{(d.unpaid_revenue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
        </CardContent></Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base"><TrendingUp className="w-4 h-4 inline mr-2" />Monthly Revenue</CardTitle></CardHeader>
          <CardContent>
            {(d.monthly_data || []).length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={d.monthly_data}>
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="revenue" fill="#059669" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-center text-gray-400 py-8">No data yet</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Payment Methods</CardTitle></CardHeader>
          <CardContent>
            {paymentPie.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={paymentPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    {paymentPie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-center text-gray-400 py-8">No data yet</p>}
          </CardContent>
        </Card>
      </div>

      {/* Recent Invoices */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Recent Invoices</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => navigate('/invoice-manager/invoices')} data-testid="inv-view-all-invoices">View All</Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {(d.recent_invoices || []).length === 0 ? (
              <p className="text-center text-gray-400 py-4">No invoices yet</p>
            ) : d.recent_invoices.map((inv) => (
              <div
                key={inv.invoice_id}
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 cursor-pointer transition"
                onClick={() => navigate(`/invoice-manager/invoices/${inv.invoice_id}`)}
                data-testid={`inv-recent-${inv.invoice_id}`}
              >
                <div>
                  <p className="font-medium text-sm">{inv.invoice_number}</p>
                  <p className="text-xs text-gray-500">{inv.customer_details?.name}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-sm">Rs.{inv.grand_total?.toFixed(2)}</p>
                  <Badge variant={inv.payment_status === 'paid' ? 'default' : 'secondary'} className="text-xs">
                    {inv.payment_status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
