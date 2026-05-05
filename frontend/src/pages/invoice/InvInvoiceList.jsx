import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { invoiceAPI } from '../../services/invoiceApi';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { FileText, Plus, Search, Trash2, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { toast } from 'sonner';

export default function InvInvoiceList() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await invoiceAPI.list({ page, limit: 20, search, status: statusFilter });
      setInvoices(res.data.invoices || []);
      setPages(res.data.pages || 1);
      setTotal(res.data.total || 0);
    } catch {
      toast.error('Failed to load invoices');
    }
    setLoading(false);
  }, [page, search, statusFilter]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this invoice?')) return;
    try {
      await invoiceAPI.delete(id);
      toast.success('Invoice deleted');
      fetchInvoices();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to delete');
    }
  };

  const handleDeleteAllUnpaid = async () => {
    if (!window.confirm('Delete ALL unpaid invoices? This cannot be undone.')) return;
    try {
      const res = await invoiceAPI.deleteAllUnpaid();
      toast.success(res.data.message);
      fetchInvoices();
    } catch {
      toast.error('Failed to delete');
    }
  };

  const handleExport = async () => {
    try {
      const res = await invoiceAPI.exportCSV();
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url; a.download = 'invoices_export.csv'; a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Export failed');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Invoices</h1>
          <p className="text-sm text-gray-500">{total} total invoices</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} data-testid="inv-list-export"><Download className="w-4 h-4 mr-1" />CSV</Button>
          <Button variant="outline" size="sm" onClick={handleDeleteAllUnpaid} className="text-red-600 border-red-200" data-testid="inv-delete-all-unpaid"><Trash2 className="w-4 h-4 mr-1" />Unpaid</Button>
          <Button size="sm" onClick={() => navigate('/invoice-manager/invoices/create')} className="bg-emerald-700 hover:bg-emerald-800" data-testid="inv-list-create"><Plus className="w-4 h-4 mr-1" />New Invoice</Button>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search invoices..." className="pl-10" data-testid="inv-list-search" />
        </div>
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-36" data-testid="inv-list-status-filter"><SelectValue placeholder="All Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="unpaid">Unpaid</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="hidden sm:table-cell">Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-2 border-emerald-600 border-t-transparent mx-auto" /></TableCell></TableRow>
              ) : invoices.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-gray-400">No invoices found</TableCell></TableRow>
              ) : invoices.map(inv => (
                <TableRow key={inv.invoice_id} className="cursor-pointer hover:bg-gray-50" onClick={() => navigate(`/invoice-manager/invoices/${inv.invoice_id}`)} data-testid={`inv-row-${inv.invoice_id}`}>
                  <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                  <TableCell>
                    <div className="text-sm">{inv.customer_details?.name}</div>
                    <div className="text-xs text-gray-500">{inv.customer_details?.email}</div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-gray-500">{inv.created_at?.slice(0, 10)}</TableCell>
                  <TableCell className="text-right font-semibold">Rs.{inv.grand_total?.toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant={inv.payment_status === 'paid' ? 'default' : 'secondary'} className={inv.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}>
                      {inv.payment_status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleDelete(inv.invoice_id); }} data-testid={`inv-delete-${inv.invoice_id}`}>
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)} data-testid="inv-list-prev"><ChevronLeft className="w-4 h-4" /></Button>
          <span className="text-sm text-gray-500">Page {page} of {pages}</span>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)} data-testid="inv-list-next"><ChevronRight className="w-4 h-4" /></Button>
        </div>
      )}
    </div>
  );
}
