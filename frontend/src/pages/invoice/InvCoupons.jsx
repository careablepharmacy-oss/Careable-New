import { useState, useEffect } from 'react';
import { couponAPI } from '../../services/invoiceApi';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Switch } from '../../components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Tag, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function InvCoupons() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    code: '', discount_type: 'percentage', discount_value: '', min_order_value: '',
    max_discount: '', max_usage: '100', valid_until: '',
  });

  const fetchCoupons = async () => {
    setLoading(true);
    try { const res = await couponAPI.list(); setCoupons(res.data.coupons); }
    catch { toast.error('Failed to load coupons'); }
    setLoading(false);
  };

  useEffect(() => { fetchCoupons(); }, []);

  const handleCreate = async () => {
    if (!form.code || !form.discount_value) { toast.error('Code and discount value required'); return; }
    try {
      await couponAPI.create({
        code: form.code, discount_type: form.discount_type,
        discount_value: parseFloat(form.discount_value),
        min_order_value: parseFloat(form.min_order_value) || 0,
        max_discount: form.max_discount ? parseFloat(form.max_discount) : null,
        max_usage: parseInt(form.max_usage) || 100,
        valid_until: form.valid_until || null,
      });
      toast.success('Coupon created!');
      setDialogOpen(false);
      setForm({ code: '', discount_type: 'percentage', discount_value: '', min_order_value: '', max_discount: '', max_usage: '100', valid_until: '' });
      fetchCoupons();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to create'); }
  };

  const toggleActive = async (coupon) => {
    try {
      await couponAPI.update(coupon.coupon_id, { is_active: !coupon.is_active });
      toast.success(`Coupon ${coupon.is_active ? 'deactivated' : 'activated'}`);
      fetchCoupons();
    } catch { toast.error('Failed to update'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this coupon?')) return;
    try { await couponAPI.delete(id); toast.success('Coupon deleted'); fetchCoupons(); }
    catch { toast.error('Failed to delete'); }
  };

  const activeCoupons = coupons.filter(c => c.is_active).length;
  const totalRedeemed = coupons.reduce((s, c) => s + (c.usage_count || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Coupon Codes</h1>
          <p className="text-sm text-gray-500">{coupons.length} coupons, {activeCoupons} active</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="bg-emerald-700 hover:bg-emerald-800" data-testid="inv-create-coupon"><Plus className="w-4 h-4 mr-1" />Create Coupon</Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="pt-3 text-center"><p className="text-xs text-gray-500">Total</p><p className="text-lg font-bold">{coupons.length}</p></CardContent></Card>
        <Card><CardContent className="pt-3 text-center"><p className="text-xs text-gray-500">Active</p><p className="text-lg font-bold text-emerald-600">{activeCoupons}</p></CardContent></Card>
        <Card><CardContent className="pt-3 text-center"><p className="text-xs text-gray-500">Redemptions</p><p className="text-lg font-bold text-blue-600">{totalRedeemed}</p></CardContent></Card>
      </div>

      <Card><CardContent className="p-0"><Table>
        <TableHeader><TableRow>
          <TableHead>Code</TableHead><TableHead>Discount</TableHead><TableHead>Min Order</TableHead>
          <TableHead>Usage</TableHead><TableHead>Status</TableHead><TableHead>Expires</TableHead><TableHead>Actions</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {loading ? <TableRow><TableCell colSpan={7} className="text-center py-8">Loading...</TableCell></TableRow> :
           coupons.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-gray-400">No coupons yet</TableCell></TableRow> :
           coupons.map(cp => (
            <TableRow key={cp.coupon_id} data-testid={`inv-coupon-row-${cp.coupon_id}`}>
              <TableCell><Badge variant="outline" className="font-mono">{cp.code}</Badge></TableCell>
              <TableCell>
                {cp.discount_type === 'percentage' ? `${cp.discount_value}%` : `Rs.${cp.discount_value}`}
                {cp.max_discount && <span className="text-xs text-gray-400 block">Max: Rs.{cp.max_discount}</span>}
              </TableCell>
              <TableCell>{cp.min_order_value ? `Rs.${cp.min_order_value}` : '-'}</TableCell>
              <TableCell>{cp.usage_count || 0} / {cp.max_usage}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Switch checked={cp.is_active} onCheckedChange={() => toggleActive(cp)} data-testid={`inv-toggle-coupon-${cp.coupon_id}`} />
                  <span className="text-xs">{cp.is_active ? 'Active' : 'Inactive'}</span>
                </div>
              </TableCell>
              <TableCell className="text-sm">{cp.valid_until ? cp.valid_until.slice(0, 10) : 'Never'}</TableCell>
              <TableCell><Button variant="ghost" size="sm" onClick={() => handleDelete(cp.coupon_id)} data-testid={`inv-delete-coupon-${cp.coupon_id}`}><Trash2 className="w-4 h-4 text-red-400" /></Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table></CardContent></Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent><DialogHeader><DialogTitle>Create Coupon Code</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Coupon Code *</Label><Input value={form.code} onChange={e => setForm(prev => ({ ...prev, code: e.target.value.toUpperCase() }))} placeholder="e.g. SAVE20" data-testid="inv-coupon-code-input" /></div>
            <div><Label>Discount Type</Label>
              <Select value={form.discount_type} onValueChange={v => setForm(prev => ({ ...prev, discount_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="percentage">Percentage (%)</SelectItem><SelectItem value="fixed">Fixed (Rs.)</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>Discount Value *</Label><Input value={form.discount_value} onChange={e => setForm(prev => ({ ...prev, discount_value: e.target.value }))} data-testid="inv-coupon-value-input" /></div>
            <div><Label>Max Discount (Rs.)</Label><Input value={form.max_discount} onChange={e => setForm(prev => ({ ...prev, max_discount: e.target.value }))} placeholder="Optional" /></div>
            <div><Label>Min Order Value</Label><Input value={form.min_order_value} onChange={e => setForm(prev => ({ ...prev, min_order_value: e.target.value }))} placeholder="0" /></div>
            <div><Label>Max Usage</Label><Input value={form.max_usage} onChange={e => setForm(prev => ({ ...prev, max_usage: e.target.value }))} /></div>
            <div><Label>Expiry Date (optional)</Label><Input type="date" value={form.valid_until} onChange={e => setForm(prev => ({ ...prev, valid_until: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} className="bg-emerald-700 hover:bg-emerald-800" data-testid="inv-confirm-create-coupon">Create Coupon</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
