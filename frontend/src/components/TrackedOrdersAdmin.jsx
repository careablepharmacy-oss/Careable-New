import React, { useEffect, useState, useCallback } from 'react';
import { Truck, Plus, RefreshCw, Trash2, AlertTriangle, ExternalLink, Pencil, X } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { toast } from '../hooks/use-toast';
import apiService from '../services/api';

const STATUSES = ['Pending', 'Shipped', 'In Transit', 'Out for Delivery', 'Delivered', 'Cancelled', 'Failed'];

const STATUS_BADGE = {
  'Pending': 'bg-slate-100 text-slate-700',
  'Shipped': 'bg-blue-100 text-blue-700',
  'In Transit': 'bg-indigo-100 text-indigo-700',
  'Out for Delivery': 'bg-amber-100 text-amber-800',
  'Delivered': 'bg-emerald-100 text-emerald-700',
  'Cancelled': 'bg-red-100 text-red-700',
  'Failed': 'bg-red-100 text-red-700',
};

const formatTs = (s) => {
  if (!s) return '—';
  const d = new Date(String(s).replace(' ', 'T'));
  if (isNaN(d)) return s;
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const TrackedOrdersAdmin = ({ userId, userName }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshingId, setRefreshingId] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null); // order being edited

  const [form, setForm] = useState({ type: 'medicine', label: '', tracking_url: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiService.get(`/api/crm/tracked-orders?user_id=${encodeURIComponent(userId)}`);
      setOrders(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      toast({ title: 'Could not load tracked orders', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { if (userId) fetchOrders(); }, [userId, fetchOrders]);

  const resetForm = () => setForm({ type: 'medicine', label: '', tracking_url: '', notes: '' });

  const handleCreate = async () => {
    if (!form.tracking_url.trim()) {
      toast({ title: 'Tracking URL required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await apiService.post('/api/crm/tracked-orders', { user_id: userId, ...form });
      toast({ title: 'Order added', description: 'Initial status fetched.' });
      setShowAdd(false);
      resetForm();
      fetchOrders();
    } catch (e) {
      toast({ title: 'Failed to add order', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleRefresh = async (orderId) => {
    setRefreshingId(orderId);
    try {
      await apiService.post(`/api/crm/tracked-orders/${orderId}/refresh`);
      fetchOrders();
    } catch (e) {
      toast({ title: 'Refresh failed', description: e.message, variant: 'destructive' });
    } finally {
      setRefreshingId(null);
    }
  };

  const handleDelete = async (orderId) => {
    if (!window.confirm('Delete this tracked order? The courier link will not be touched.')) return;
    try {
      await apiService.request(`/api/crm/tracked-orders/${orderId}`, { method: 'DELETE' });
      fetchOrders();
    } catch (e) {
      toast({ title: 'Delete failed', description: e.message, variant: 'destructive' });
    }
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const body = {};
      if (editing.statusChanged) body.status = editing.status;
      if (editing.cancelOverride) body.cancel_override = true;
      if (editing.label !== undefined) body.label = editing.label;
      if (editing.notes !== undefined) body.notes = editing.notes;
      await apiService.request(`/api/crm/tracked-orders/${editing.id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      toast({ title: 'Updated' });
      setEditing(null);
      fetchOrders();
    } catch (e) {
      toast({ title: 'Update failed', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card data-testid="tracked-orders-admin-panel">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Truck className="h-4 w-4 text-teal-500" />
            Order Tracking
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchOrders} disabled={loading}
                    data-testid="refresh-tracked-list-btn">
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            <Button size="sm" className="gradient-teal text-white" onClick={() => setShowAdd(true)}
                    data-testid="add-tracked-order-btn">
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Tracking Link
            </Button>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Paste a 1mg/ClickPost tracking URL — status auto-syncs every 3 hours.
        </p>
      </CardHeader>

      <CardContent>
        {orders.length === 0 ? (
          <p className="text-center text-slate-500 py-8 text-sm" data-testid="tracked-orders-empty-admin">
            No tracked orders yet for {userName || 'this patient'}.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="tracked-orders-table">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b">
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">Label / AWB</th>
                  <th className="py-2 pr-3">Carrier</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Last update</th>
                  <th className="py-2 pr-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o, i) => (
                  <tr key={o.id} className="border-b last:border-b-0 hover:bg-slate-50"
                      data-testid={`tracked-order-row-${i}`}>
                    <td className="py-2 pr-3 capitalize text-slate-700">{o.type}</td>
                    <td className="py-2 pr-3">
                      <p className="font-medium text-slate-800 truncate max-w-[160px]">
                        {o.label || '—'}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate max-w-[160px]">
                        {o.waybill || '—'}
                      </p>
                    </td>
                    <td className="py-2 pr-3 text-slate-600">{o.carrier || '—'}</td>
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="secondary" className={STATUS_BADGE[o.status] || 'bg-slate-100 text-slate-700'}>
                          {o.status}
                        </Badge>
                        {o.flags?.stuck && (
                          <Badge className="bg-amber-500 text-white text-[10px] px-1.5 py-0" data-testid={`admin-stuck-badge-${i}`}>
                            <AlertTriangle className="h-2.5 w-2.5 mr-0.5 inline" /> Stuck
                          </Badge>
                        )}
                        {o.manual_override && (
                          <Badge variant="outline" className="border-purple-300 text-purple-700 text-[10px]">Manual</Badge>
                        )}
                      </div>
                      {o.last_event && (
                        <p className="text-[11px] text-slate-500 mt-1 truncate max-w-[200px]">{o.last_event}</p>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-slate-600 text-[11px]">{formatTs(o.last_event_at || o.last_checked_at)}</td>
                    <td className="py-2 pr-3 text-right whitespace-nowrap">
                      <a href={o.tracking_url} target="_blank" rel="noopener noreferrer"
                         className="inline-flex items-center text-slate-500 hover:text-slate-800 mr-1"
                         data-testid={`open-tracking-link-${i}`} title="Open courier page">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                              disabled={refreshingId === o.id || o.manual_override}
                              onClick={() => handleRefresh(o.id)} data-testid={`refresh-row-${i}`}
                              title={o.manual_override ? 'Override active – clear it to auto-refresh' : 'Refresh'}>
                        <RefreshCw className={`h-3.5 w-3.5 ${refreshingId === o.id ? 'animate-spin' : ''}`} />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                              onClick={() => setEditing({
                                id: o.id, status: o.status, label: o.label || '',
                                notes: o.notes || '', manual_override: !!o.manual_override,
                                statusChanged: false, cancelOverride: false,
                              })}
                              data-testid={`edit-row-${i}`} title="Edit / override">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-600 hover:text-red-700"
                              onClick={() => handleDelete(o.id)} data-testid={`delete-row-${i}`} title="Delete">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      {/* Add dialog */}
      <Dialog open={showAdd} onOpenChange={(v) => { setShowAdd(v); if (!v) resetForm(); }}>
        <DialogContent data-testid="add-tracked-order-dialog">
          <DialogHeader>
            <DialogTitle>Add tracking link</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Order type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger data-testid="add-type-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="medicine">Medicine</SelectItem>
                  <SelectItem value="injection">Injection</SelectItem>
                  <SelectItem value="product">Product</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Label (optional)</Label>
              <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })}
                     placeholder="e.g. Apr 2026 monthly refill" data-testid="add-label-input" />
            </div>
            <div>
              <Label className="text-xs">Tracking URL</Label>
              <Input value={form.tracking_url} onChange={(e) => setForm({ ...form, tracking_url: e.target.value })}
                     placeholder="https://1mg.clickpost.in/?waybill=..." data-testid="add-url-input" />
              <p className="text-[10px] text-slate-500 mt-1">Currently supports 1mg/ClickPost tracking pages.</p>
            </div>
            <div>
              <Label className="text-xs">Internal notes (optional)</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                     placeholder="Anything for your team" data-testid="add-notes-input" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)} data-testid="add-cancel-btn">Cancel</Button>
            <Button className="gradient-teal text-white" onClick={handleCreate} disabled={saving}
                    data-testid="add-save-btn">
              {saving ? 'Saving...' : 'Add & sync now'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit / override dialog */}
      <Dialog open={!!editing} onOpenChange={(v) => { if (!v) setEditing(null); }}>
        <DialogContent data-testid="edit-tracked-order-dialog">
          <DialogHeader>
            <DialogTitle>Edit / Manual override</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Label</Label>
                <Input value={editing.label}
                       onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                       data-testid="edit-label-input" />
              </div>
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={editing.status}
                        onValueChange={(v) => setEditing({ ...editing, status: v, statusChanged: true })}>
                  <SelectTrigger data-testid="edit-status-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-slate-500 mt-1">
                  Changing status here pauses auto-sync (manual override).
                </p>
              </div>
              <div>
                <Label className="text-xs">Notes</Label>
                <Input value={editing.notes}
                       onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                       data-testid="edit-notes-input" />
              </div>
              {editing.manual_override && !editing.statusChanged && (
                <button
                  onClick={() => setEditing({ ...editing, cancelOverride: true })}
                  className="text-xs text-purple-700 underline"
                  data-testid="clear-override-btn"
                >
                  {editing.cancelOverride ? '✓ Will resume auto-sync' : 'Resume auto-sync (clear override)'}
                </button>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} data-testid="edit-cancel-btn">
              <X className="h-3.5 w-3.5 mr-1" /> Cancel
            </Button>
            <Button className="gradient-teal text-white" onClick={handleSaveEdit} disabled={saving}
                    data-testid="edit-save-btn">
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default TrackedOrdersAdmin;
