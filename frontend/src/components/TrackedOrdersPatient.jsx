import React, { useEffect, useState } from 'react';
import { Truck, MapPin, RefreshCw, ChevronDown, ChevronUp, Pill, Syringe, ShoppingBag, AlertTriangle } from 'lucide-react';
import apiService from '../services/api';
import { toast } from '../hooks/use-toast';

const STATUS_STYLES = {
  'Pending':          { bg: 'bg-slate-100',   text: 'text-slate-700',   dot: 'bg-slate-400' },
  'Shipped':          { bg: 'bg-blue-100',    text: 'text-blue-700',    dot: 'bg-blue-500' },
  'In Transit':       { bg: 'bg-indigo-100',  text: 'text-indigo-700',  dot: 'bg-indigo-500' },
  'Out for Delivery': { bg: 'bg-amber-100',   text: 'text-amber-800',   dot: 'bg-amber-500' },
  'Delivered':        { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  'Cancelled':        { bg: 'bg-red-100',     text: 'text-red-700',     dot: 'bg-red-500' },
  'Failed':           { bg: 'bg-red-100',     text: 'text-red-700',     dot: 'bg-red-500' },
};

const TYPE_ICON = { medicine: Pill, injection: Syringe, product: ShoppingBag };
const TYPE_LABEL = { medicine: 'Medicine', injection: 'Injection', product: 'Product' };

const formatTs = (s) => {
  if (!s) return '';
  const d = new Date(s.replace(' ', 'T'));
  if (isNaN(d)) return s;
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const TrackedOrderCard = ({ order, onRefreshed }) => {
  const [expanded, setExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const style = STATUS_STYLES[order.status] || STATUS_STYLES.Pending;
  const TypeIcon = TYPE_ICON[order.type] || Pill;
  const isStuck = order?.flags?.stuck;

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await apiService.post(`/api/users/me/tracked-orders/${order.id}/refresh`);
      toast({ title: 'Refreshed', description: 'Latest delivery status pulled.' });
      onRefreshed?.();
    } catch (e) {
      toast({ title: 'Refresh failed', description: e.message, variant: 'destructive' });
    } finally {
      setRefreshing(false);
    }
  };

  const events = order.events || [];
  const visibleEvents = expanded ? events.slice().reverse() : events.slice(-3).reverse();

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 hover:shadow-md transition-shadow"
         data-testid={`tracked-order-${order.id}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#2BA89F]/15 to-[#1E3A5F]/10 flex items-center justify-center shrink-0">
            <TypeIcon className="w-5 h-5 text-[#1E3A5F]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-sm text-gray-900 truncate">
                {order.label || `${TYPE_LABEL[order.type] || 'Order'} delivery`}
              </p>
              {isStuck && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800"
                      data-testid={`stuck-badge-${order.id}`}>
                  <AlertTriangle className="w-3 h-3" /> Stuck
                </span>
              )}
            </div>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {order.carrier || 'Tracking'} {order.waybill ? `· AWB ${order.waybill}` : ''}
            </p>
          </div>
        </div>
        <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${style.bg} ${style.text} whitespace-nowrap`}
              data-testid={`status-pill-${order.id}`}>
          {order.status}
        </span>
      </div>

      {/* Latest event */}
      {(order.last_event || order.current_location) && (
        <div className="mt-3 px-3 py-2 rounded-lg bg-gray-50 text-xs">
          <div className="flex items-start gap-2 text-gray-700">
            <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="font-medium truncate">{order.last_event || 'Update'}</p>
              {order.current_location && <p className="text-gray-500 truncate">{order.current_location}</p>}
              {order.last_event_at && (
                <p className="text-gray-400 text-[10px] mt-0.5">{formatTs(order.last_event_at)}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Timeline */}
      {events.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs font-medium text-[#1E3A5F] hover:text-[#2BA89F] flex items-center gap-1"
            data-testid={`toggle-timeline-${order.id}`}
          >
            {expanded ? 'Hide history' : `Show full history (${events.length} events)`}
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          <div className="mt-2 pl-2 border-l-2 border-gray-100 space-y-2.5">
            {visibleEvents.map((ev, i) => (
              <div key={i} className="relative pl-3" data-testid={`event-${order.id}-${i}`}>
                <span className={`absolute -left-[5px] top-1.5 w-2 h-2 rounded-full ${i === 0 ? style.dot : 'bg-gray-300'}`} />
                <p className="text-xs text-gray-800 font-medium">{ev.remark || ev.bucket_description}</p>
                <p className="text-[10px] text-gray-500">{formatTs(ev.timestamp)} {ev.location ? `· ${ev.location}` : ''}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="mt-3 flex items-center justify-between pt-3 border-t border-gray-100">
        <a
          href={order.tracking_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium text-[#2BA89F] hover:text-[#1E3A5F]"
          data-testid={`open-tracking-${order.id}`}
        >
          Open courier page
        </a>
        <button
          onClick={handleRefresh}
          disabled={refreshing || order.manual_override}
          className="text-xs font-medium text-gray-600 hover:text-gray-900 flex items-center gap-1 disabled:opacity-40"
          data-testid={`refresh-tracking-${order.id}`}
          title={order.manual_override ? 'Status set manually by your care team' : 'Refresh now'}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          {order.manual_override ? 'Manual' : 'Refresh'}
        </button>
      </div>
    </div>
  );
};

const TrackedOrdersPatient = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    try {
      const data = await apiService.get('/api/users/me/tracked-orders');
      setOrders(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Tracked orders load failed:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrders(); }, []);

  if (loading) return null; // OrdersList already shows a skeleton above

  if (!orders.length) return null;

  return (
    <div className="space-y-3" data-testid="tracked-orders-patient-section">
      <div className="flex items-center gap-2 px-1">
        <Truck className="w-4 h-4 text-[#2BA89F]" />
        <h3 className="text-sm font-semibold text-gray-800">Live Delivery Tracking</h3>
        <span className="text-[10px] text-gray-400">Auto-updates every 3 hours</span>
      </div>
      {orders.map((o) => (
        <TrackedOrderCard key={o.id} order={o} onRefreshed={fetchOrders} />
      ))}
    </div>
  );
};

export default TrackedOrdersPatient;
