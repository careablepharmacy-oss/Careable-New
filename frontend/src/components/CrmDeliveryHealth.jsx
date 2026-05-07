import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Truck, AlertTriangle, ChevronRight } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import apiService from '../services/api';

const TRACKING_BADGE = {
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

const CrmDeliveryHealth = () => {
  const [data, setData] = useState({ flagged: [], active_count: 0, flagged_count: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiService.get('/api/inv/admin/orders/flagged');
        setData(res || { flagged: [], active_count: 0, flagged_count: 0 });
      } catch (e) {
        console.error('Delivery health load failed:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return null;

  const { flagged, active_count: activeCount, flagged_count: flaggedCount } = data;

  return (
    <Card className="border-slate-200" data-testid="delivery-health-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-teal-500 flex items-center justify-center text-white">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold">Delivery Health</CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                {activeCount} active shipment{activeCount !== 1 ? 's' : ''}
                {flaggedCount > 0 ? ` · ${flaggedCount} need${flaggedCount === 1 ? 's' : ''} attention` : ''}
              </p>
            </div>
          </div>
          {flaggedCount > 0 && (
            <Badge className="bg-amber-500 text-white" data-testid="delivery-flagged-count">
              {flaggedCount}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {flaggedCount === 0 && activeCount === 0 ? (
          <p className="text-center text-slate-500 py-4 text-sm" data-testid="delivery-health-empty">
            No tracked deliveries yet. Attach a 1mg URL to a paid order to enable auto-tracking.
          </p>
        ) : flaggedCount === 0 ? (
          <p className="text-center text-emerald-700 py-4 text-sm" data-testid="delivery-health-all-good">
            All {activeCount} active shipment{activeCount !== 1 ? 's are' : ' is'} on track.
          </p>
        ) : (
          <div className="space-y-2">
            {flagged.slice(0, 6).map((o, i) => (
              <Link to={o.patient_id ? `/crm/patients/${o.patient_id}` : '/invoice-manager/orders'} key={o.order_id}
                    data-testid={`flagged-row-${i}`}>
                <div className="flex items-center gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 transition">
                  <div className="w-9 h-9 rounded-full bg-amber-500/10 text-amber-700 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {o.patient_name} · {o.order_id}
                    </p>
                    <p className="text-xs text-slate-600 truncate">
                      {o.tracking_carrier || 'Unknown'} · {o.tracking_last_event || 'No recent updates'} · last {formatTs(o.tracking_last_event_at)}
                    </p>
                  </div>
                  <Badge variant="secondary" className={TRACKING_BADGE[o.tracking_status] || 'bg-slate-100 text-slate-700'}>
                    {o.tracking_status}
                  </Badge>
                  <ChevronRight className="h-4 w-4 text-amber-500 flex-shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CrmDeliveryHealth;
