import React, { useEffect, useState, useCallback } from 'react';
import { Truck, Plus, RefreshCw, AlertTriangle, ExternalLink, Pencil, X, Package } from 'lucide-react';
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

const TRACKING_BADGE = {
  'Pending': 'bg-slate-100 text-slate-700',
  'Shipped': 'bg-blue-100 text-blue-700',
  'In Transit': 'bg-indigo-100 text-indigo-700',
  'Out for Delivery': 'bg-amber-100 text-amber-800',
  'Delivered': 'bg-emerald-100 text-emerald-700',
  'Cancelled': 'bg-red-100 text-red-700',
  'Failed': 'bg-red-100 text-red-700',
};

const INTERNAL_BADGE = {
  Pending: 'bg-slate-100 text-slate-700',
  Processing: 'bg-blue-100 text-blue-700',
  Shipped: 'bg-indigo-100 text-indigo-700',
  Delivered: 'bg-emerald-100 text-emerald-700',
};

const formatTs = (s) => {
  if (!s) return '—';
  const d = new Date(String(s).replace(' ', 'T'));
  if (isNaN(d)) return s;
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const PatientOrdersAdmin = ({ orders = [], onChanged, userName }) => {
  const [refreshingId, setRefreshingId] = useState(null);
  const [attaching, setAttaching] = useState(null); // {order_id, current_url, label}
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleAttach = async (orderId, url) => {
    setSaving(true);
    try {
      await apiService.request(`/api/inv/admin/orders/${orderId}/tracking`, {
        method: 'PATCH',
        body: JSON.stringify({ tracking_url: url }),
      });
      toast({ title: url ? 'Tracking attached' : 'Tracking cleared', description: url ? 'Initial sync complete.' : '' });
      setAttaching(null);
      onChanged?.();
    } catch (e) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleRefresh = async (orderId) => {
    setRefreshingId(orderId);
    try {
      await apiService.post(`/api/inv/admin/orders/${orderId}/tracking/refresh`);
      onChanged?.();
    } catch (e) {
      toast({ title: 'Refresh failed', description: e.message, variant: 'destructive' });
    } finally {
      setRefreshingId(null);
    }
  };

  const handleSaveOverride = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const body = {};
      if (editing.statusChanged) body.tracking_status = editing.status;
      if (editing.cancelOverride) body.cancel_override = true;
      await apiService.request(`/api/inv/admin/orders/${editing.order_id}/tracking/manual`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      toast({ title: 'Updated' });
      setEditing(null);
      onChanged?.();
    } catch (e) {
      toast({ title: 'Update failed', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card data-testid="patient-orders-admin-panel">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4 text-teal-500" />
            Patient Orders &amp; Delivery Tracking
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => onChanged?.()}
                  data-testid="refresh-orders-list-btn">
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
          </Button>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Each row is a real order from a paid invoice. Paste the 1mg tracking URL to enable auto-status sync (every 3 hours).
        </p>
      </CardHeader>

      <CardContent>
        {orders.length === 0 ? (
          <p className="text-center text-slate-500 py-8 text-sm" data-testid="patient-orders-empty">
            No paid orders yet for {userName || 'this patient'}. Orders appear here after payment is recorded against an invoice.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="patient-orders-table">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b">
                  <th className="py-2 pr-3">Order #</th>
                  <th className="py-2 pr-3">Created</th>
                  <th className="py-2 pr-3 text-right">Amount</th>
                  <th className="py-2 pr-3">Internal</th>
                  <th className="py-2 pr-3">1mg Tracking</th>
                  <th className="py-2 pr-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o, i) => (
                  <tr key={o.order_id} className="border-b last:border-b-0 hover:bg-slate-50"
                      data-testid={`patient-order-row-${i}`}>
                    <td className="py-2 pr-3 font-mono text-xs text-slate-800">{o.order_id}</td>
                    <td className="py-2 pr-3 text-slate-600 text-[11px]">{formatTs(o.created_at)}</td>
                    <td className="py-2 pr-3 text-right font-semibold text-emerald-700">
                      ₹{Number(o.price || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="py-2 pr-3">
                      <Badge variant="secondary" className={INTERNAL_BADGE[o.status] || 'bg-slate-100 text-slate-700'}>
                        {o.status || 'Pending'}
                      </Badge>
                    </td>
                    <td className="py-2 pr-3">
                      {o.tracking_url ? (
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge variant="secondary" className={TRACKING_BADGE[o.tracking_status] || 'bg-slate-100 text-slate-700'}>
                              {o.tracking_status || 'Syncing...'}
                            </Badge>
                            {o.tracking_flags?.stuck && (
                              <Badge className="bg-amber-500 text-white text-[10px] px-1.5 py-0" data-testid={`stuck-${i}`}>
                                <AlertTriangle className="h-2.5 w-2.5 mr-0.5 inline" /> Stuck
                              </Badge>
                            )}
                            {o.tracking_manual_override && (
                              <Badge variant="outline" className="border-purple-300 text-purple-700 text-[10px]">Manual</Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500">
                            {o.tracking_carrier || 'Pending'}{o.tracking_waybill ? ` · ${o.tracking_waybill}` : ''}
                          </p>
                          {o.tracking_last_event && (
                            <p className="text-[11px] text-slate-500 truncate max-w-[200px]">{o.tracking_last_event}</p>
                          )}
                        </div>
                      ) : (
                        <Button variant="outline" size="sm" className="h-7 text-xs"
                                onClick={() => setAttaching({ order_id: o.order_id, url: '' })}
                                data-testid={`attach-tracking-${i}`}>
                          <Plus className="h-3 w-3 mr-1" /> Attach 1mg URL
                        </Button>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-right whitespace-nowrap">
                      {o.tracking_url && (
                        <>
                          <a href={o.tracking_url} target="_blank" rel="noopener noreferrer"
                             className="inline-flex items-center text-slate-500 hover:text-slate-800 mr-1"
                             data-testid={`open-tracking-link-${i}`} title="Open courier page">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                                  disabled={refreshingId === o.order_id || o.tracking_manual_override}
                                  onClick={() => handleRefresh(o.order_id)} data-testid={`refresh-row-${i}`}
                                  title={o.tracking_manual_override ? 'Override active' : 'Refresh'}>
                            <RefreshCw className={`h-3.5 w-3.5 ${refreshingId === o.order_id ? 'animate-spin' : ''}`} />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                                  onClick={() => setEditing({
                                    order_id: o.order_id,
                                    status: o.tracking_status || 'Pending',
                                    manual_override: !!o.tracking_manual_override,
                                    statusChanged: false, cancelOverride: false,
                                  })}
                                  data-testid={`edit-row-${i}`} title="Manual override">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-500"
                                  onClick={() => setAttaching({ order_id: o.order_id, url: o.tracking_url })}
                                  data-testid={`change-url-${i}`} title="Change URL">
                            Change
                          </Button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      {/* Attach / change URL dialog */}
      <Dialog open={!!attaching} onOpenChange={(v) => { if (!v) setAttaching(null); }}>
        <DialogContent data-testid="attach-tracking-dialog">
          <DialogHeader>
            <DialogTitle>{attaching?.url ? 'Update tracking link' : 'Attach 1mg tracking link'}</DialogTitle>
          </DialogHeader>
          {attaching && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Order #</Label>
                <p className="font-mono text-sm text-slate-800 mt-1">{attaching.order_id}</p>
              </div>
              <div>
                <Label className="text-xs">1mg / ClickPost tracking URL</Label>
                <Input value={attaching.url || ''}
                       onChange={(e) => setAttaching({ ...attaching, url: e.target.value })}
                       placeholder="https://1mg.clickpost.in/?waybill=..." data-testid="attach-url-input" />
                <p className="text-[10px] text-slate-500 mt-1">
                  Status, carrier, AWB and timeline are pulled automatically and refreshed every 3 hours.
                </p>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            {attaching?.url && (
              <Button variant="outline" className="text-red-600 border-red-300 hover:bg-red-50 mr-auto"
                      onClick={() => handleAttach(attaching.order_id, '')} disabled={saving}
                      data-testid="clear-tracking-btn">
                <X className="h-3.5 w-3.5 mr-1" /> Remove tracking
              </Button>
            )}
            <Button variant="outline" onClick={() => setAttaching(null)} data-testid="attach-cancel-btn">Cancel</Button>
            <Button className="gradient-teal text-white"
                    onClick={() => handleAttach(attaching.order_id, attaching.url || '')}
                    disabled={saving || !attaching?.url?.trim()}
                    data-testid="attach-save-btn">
              {saving ? 'Saving...' : 'Attach &amp; sync now'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual override dialog */}
      <Dialog open={!!editing} onOpenChange={(v) => { if (!v) setEditing(null); }}>
        <DialogContent data-testid="override-tracking-dialog">
          <DialogHeader>
            <DialogTitle>Manual override</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Tracking status</Label>
                <Select value={editing.status}
                        onValueChange={(v) => setEditing({ ...editing, status: v, statusChanged: true })}>
                  <SelectTrigger data-testid="override-status-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-slate-500 mt-1">Setting status here pauses auto-sync.</p>
              </div>
              {editing.manual_override && !editing.statusChanged && (
                <button
                  onClick={() => setEditing({ ...editing, cancelOverride: true })}
                  className="text-xs text-purple-700 underline"
                  data-testid="clear-override-btn"
                >
                  {editing.cancelOverride ? '✓ Will resume auto-sync on save' : 'Resume auto-sync (clear override)'}
                </button>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} data-testid="override-cancel-btn">Cancel</Button>
            <Button className="gradient-teal text-white" onClick={handleSaveOverride} disabled={saving}
                    data-testid="override-save-btn">
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default PatientOrdersAdmin;
