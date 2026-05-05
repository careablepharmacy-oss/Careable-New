import { useState, useEffect } from 'react';
import { Package, RefreshCw, Search } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const getStatusColor = (status) => {
  switch (status) {
    case 'Pending': return 'bg-yellow-100 text-yellow-800';
    case 'Processing': return 'bg-blue-100 text-blue-800';
    case 'Shipped': return 'bg-purple-100 text-purple-800';
    case 'Delivered': return 'bg-green-100 text-green-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

export default function InvOrderManagement() {
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const fetchOrders = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/inv/admin/orders`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setOrders(data);
        setFilteredOrders(data);
      }
    } catch {
      toast.error('Failed to fetch orders');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(() => { setRefreshing(true); fetchOrders(); }, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let filtered = orders;
    if (searchTerm) {
      filtered = filtered.filter(o =>
        o.order_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.customer_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.product_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (filterStatus !== 'all') {
      filtered = filtered.filter(o => o.status === filterStatus);
    }
    setFilteredOrders(filtered);
  }, [searchTerm, filterStatus, orders]);

  const handleStatusUpdate = async (orderId, newStatus) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/inv/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });
      if (response.ok) { fetchOrders(); toast.success('Status updated'); }
    } catch {
      toast.error('Failed to update');
    }
  };

  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === 'Pending').length,
    processing: orders.filter(o => o.status === 'Processing').length,
    shipped: orders.filter(o => o.status === 'Shipped').length,
    delivered: orders.filter(o => o.status === 'Delivered').length,
  };

  if (loading) return <div className="flex items-center justify-center min-h-[400px]"><div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-600 border-t-transparent" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Order Management</h1>
          <p className="text-sm text-gray-500">Track and manage all customer orders</p>
        </div>
        {refreshing && <RefreshCw className="w-4 h-4 animate-spin text-gray-400" />}
      </div>

      <div className="grid grid-cols-5 gap-2">
        <Card><CardContent className="pt-3 text-center"><p className="text-xs text-gray-500">Total</p><p className="text-lg font-bold">{stats.total}</p></CardContent></Card>
        <Card><CardContent className="pt-3 text-center"><p className="text-xs text-gray-500">Pending</p><p className="text-lg font-bold text-yellow-600">{stats.pending}</p></CardContent></Card>
        <Card><CardContent className="pt-3 text-center"><p className="text-xs text-gray-500">Processing</p><p className="text-lg font-bold text-blue-600">{stats.processing}</p></CardContent></Card>
        <Card><CardContent className="pt-3 text-center"><p className="text-xs text-gray-500">Shipped</p><p className="text-lg font-bold text-purple-600">{stats.shipped}</p></CardContent></Card>
        <Card><CardContent className="pt-3 text-center"><p className="text-xs text-gray-500">Delivered</p><p className="text-lg font-bold text-green-600">{stats.delivered}</p></CardContent></Card>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search orders..." className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
            data-testid="inv-order-search"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36" data-testid="inv-order-status-filter"><SelectValue placeholder="All Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Pending">Pending</SelectItem>
            <SelectItem value="Processing">Processing</SelectItem>
            <SelectItem value="Shipped">Shipped</SelectItem>
            <SelectItem value="Delivered">Delivered</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50"><tr>
            <th className="text-left p-3 font-medium text-gray-600">Order ID</th>
            <th className="text-left p-3 font-medium text-gray-600">Customer</th>
            <th className="text-left p-3 font-medium text-gray-600">Product</th>
            <th className="text-center p-3 font-medium text-gray-600">Qty</th>
            <th className="text-right p-3 font-medium text-gray-600">Price</th>
            <th className="text-center p-3 font-medium text-gray-600">Status</th>
            <th className="text-center p-3 font-medium text-gray-600">Update</th>
          </tr></thead>
          <tbody>
            {filteredOrders.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400">No orders found</td></tr>
            ) : filteredOrders.map(order => (
              <tr key={order.order_id} className="border-t hover:bg-gray-50" data-testid={`inv-order-row-${order.order_id}`}>
                <td className="p-3 font-mono text-xs">{order.order_id}</td>
                <td className="p-3"><div>{order.customer_name}</div><div className="text-xs text-gray-400">{order.customer_email}</div></td>
                <td className="p-3 max-w-[200px] truncate">{order.product_name}</td>
                <td className="p-3 text-center">{order.quantity}</td>
                <td className="p-3 text-right font-medium">Rs.{order.price?.toFixed(2)}</td>
                <td className="p-3 text-center"><Badge className={getStatusColor(order.status)}>{order.status}</Badge></td>
                <td className="p-3 text-center">
                  <Select value={order.status} onValueChange={v => handleStatusUpdate(order.order_id, v)}>
                    <SelectTrigger className="w-28" data-testid={`inv-order-update-${order.order_id}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pending">Pending</SelectItem>
                      <SelectItem value="Processing">Processing</SelectItem>
                      <SelectItem value="Shipped">Shipped</SelectItem>
                      <SelectItem value="Delivered">Delivered</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
