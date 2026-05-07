import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package, ChevronRight, ShoppingBag, Pill, Syringe, FileText, ExternalLink,
  Truck, MapPin, ChevronDown, ChevronUp,
} from 'lucide-react';
import apiService from '../services/api';

// ---- Customer-facing status maps (no courier branding) ----
const TRACKING_PILL = {
  'Pending':          'bg-slate-100 text-slate-700',
  'Shipped':          'bg-blue-100 text-blue-700',
  'In Transit':       'bg-indigo-100 text-indigo-700',
  'Out for Delivery': 'bg-amber-100 text-amber-800',
  'Delivered':        'bg-emerald-100 text-emerald-700',
  'Cancelled':        'bg-red-100 text-red-700',
  'Failed':           'bg-red-100 text-red-700',
};

const INTERNAL_PILL = {
  pending: 'bg-yellow-100 text-yellow-700',
  Pending: 'bg-yellow-100 text-yellow-700',
  Processing: 'bg-blue-100 text-blue-700',
  Shipped: 'bg-purple-100 text-purple-700',
  Delivered: 'bg-emerald-100 text-emerald-700',
  Cancelled: 'bg-red-100 text-red-700',
};

const PAYMENT_PILL = {
  paid: 'bg-emerald-100 text-emerald-700',
  pending: 'bg-yellow-100 text-yellow-700',
  failed: 'bg-red-100 text-red-700',
};

// ---- Order type tag definition ----
const typeTagStyles = {
  product: { label: 'Product',   icon: ShoppingBag, className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  medicine:{ label: 'Medicine',  icon: Pill,        className: 'bg-blue-50 text-blue-700 border-blue-200' },
  injection:{label: 'Injection', icon: Syringe,     className: 'bg-purple-50 text-purple-700 border-purple-200' },
};

const formatDate = (s) => {
  if (!s) return '';
  const d = typeof s === 'string' ? new Date(s) : s;
  if (isNaN(d)) return '';
  return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
};

const formatTs = (s) => {
  if (!s) return '';
  const d = new Date(String(s).replace(' ', 'T'));
  if (isNaN(d)) return s;
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const titleCase = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

// ---- Customer-facing tracking timeline (NO carrier/AWB/courier link visible) ----
const TrackingTimeline = ({ events, currentStatus }) => {
  const [expanded, setExpanded] = useState(false);
  if (!events || events.length === 0) return null;
  const visible = expanded ? events.slice().reverse() : events.slice(-3).reverse();
  const dotClass = currentStatus === 'Delivered' ? 'bg-emerald-500'
    : currentStatus === 'Out for Delivery' ? 'bg-amber-500'
    : currentStatus === 'In Transit' ? 'bg-indigo-500'
    : 'bg-slate-400';

  return (
    <div className="mt-3" data-testid="tracking-timeline">
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-xs font-medium text-[#1E3A5F] hover:text-[#2BA89F] flex items-center gap-1"
        data-testid="toggle-timeline-btn"
      >
        {expanded ? 'Hide history' : `Show full history (${events.length} events)`}
        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>
      <div className="mt-2 pl-2 border-l-2 border-gray-100 space-y-2.5">
        {visible.map((ev, i) => (
          <div key={i} className="relative pl-3" data-testid={`tracking-event-${i}`}>
            <span className={`absolute -left-[5px] top-1.5 w-2 h-2 rounded-full ${i === 0 ? dotClass : 'bg-gray-300'}`} />
            <p className="text-xs text-gray-800 font-medium">{ev.remark || ev.bucket_description}</p>
            <p className="text-[10px] text-gray-500">{formatTs(ev.timestamp)}{ev.location ? ` · ${ev.location}` : ''}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

// ---- Order card (paid invoice/order from inv_orders) ----
const OrderCard = ({ order }) => {
  // Choose customer-visible status: prefer tracking_status when present, else internal status
  const tracking = order.tracking_status;
  const internal = order.status || 'Pending';
  const showTracking = !!order.has_tracking && !!tracking;
  const customerStatus = showTracking ? tracking : internal;
  const pillClass = (showTracking ? TRACKING_PILL : INTERNAL_PILL)[customerStatus] || 'bg-slate-100 text-slate-700';

  const paymentMethod = order.payment_method ? order.payment_method.toUpperCase() : '';
  const paymentLabel = paymentMethod === 'COD' ? 'Cash on Delivery' : paymentMethod ? `Paid · ${paymentMethod}` : 'Paid';

  return (
    <div
      className="p-4 rounded-xl border border-gray-100 bg-white hover:border-emerald-200 hover:shadow-md transition-all"
      data-testid={`order-card-${order.order_id}`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex flex-col gap-1.5">
          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border font-medium bg-emerald-50 text-emerald-700 border-emerald-200">
            <Package className="w-3 h-3" /> Order
          </span>
          <p className="font-bold text-gray-900 text-sm font-mono">{order.order_id}</p>
          <p className="text-[11px] text-gray-500">{formatDate(order.created_at)}</p>
        </div>
        <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${pillClass}`}
              data-testid={`order-status-pill-${order.order_id}`}>
          {customerStatus}
        </span>
      </div>

      {/* Live tracking summary (carrier/AWB hidden from customer) */}
      {showTracking && (
        <div className="mt-3 px-3 py-2 rounded-lg bg-[#2BA89F]/5 text-xs border border-[#2BA89F]/20"
             data-testid={`tracking-summary-${order.order_id}`}>
          <div className="flex items-start gap-2 text-gray-700">
            <Truck className="w-3.5 h-3.5 text-[#2BA89F] shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              {order.tracking_last_event && (
                <p className="font-medium text-gray-800 truncate">{order.tracking_last_event}</p>
              )}
              {order.tracking_current_location && (
                <p className="text-gray-500 truncate flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {order.tracking_current_location}
                </p>
              )}
              {order.tracking_last_event_at && (
                <p className="text-gray-400 text-[10px] mt-0.5">Updated {formatTs(order.tracking_last_event_at)}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {showTracking && order.tracking_events?.length > 0 && (
        <TrackingTimeline events={order.tracking_events} currentStatus={tracking} />
      )}

      <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] text-gray-500">{paymentLabel}</span>
          {order.product_name && (
            <span className="text-[11px] text-gray-600 truncate max-w-[200px]">{order.product_name}</span>
          )}
        </div>
        <span className="font-bold text-emerald-600">₹{Number(order.price || 0).toLocaleString('en-IN')}</span>
      </div>
    </div>
  );
};

// ---- Cart e-commerce card (in-app cart orders, separate flow) ----
const EcommerceCard = ({ order, onClick }) => {
  const paymentKey = order.payment_status || 'pending';
  const deliveryKey = order.order_status || 'pending';
  const paymentLabel = paymentKey === 'paid' ? 'Paid' : paymentKey === 'failed' ? 'Failed' : 'Pending';
  return (
    <div
      className="p-4 rounded-xl border border-gray-100 bg-white cursor-pointer hover:border-emerald-200 hover:shadow-md transition-all"
      onClick={onClick}
      data-testid={`ecom-order-card-${order.id}`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex flex-col gap-1.5">
          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border font-medium bg-emerald-50 text-emerald-700 border-emerald-200">
            <ShoppingBag className="w-3 h-3" /> Cart Order
          </span>
          <p className="font-bold text-gray-900 text-sm">{order.order_number}</p>
          <p className="text-[11px] text-gray-500">{formatDate(order.created_at)}</p>
        </div>
        <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 my-3">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wide text-gray-500 font-medium">Payment</span>
          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${PAYMENT_PILL[paymentKey] || PAYMENT_PILL.pending}`}>
            {paymentLabel}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wide text-gray-500 font-medium">Delivery</span>
          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${INTERNAL_PILL[deliveryKey] || INTERNAL_PILL.pending}`}>
            {titleCase(deliveryKey)}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-gray-50">
        <div className="flex items-center gap-1.5">
          <Package className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-600">{order.items?.length || 0} item(s)</span>
        </div>
        <span className="font-bold text-emerald-600">₹{order.total?.toLocaleString('en-IN')}</span>
      </div>
    </div>
  );
};

// ---- Pending invoice link card (from user_purchase_links — invoice issued, not paid yet) ----
const InvoiceCard = ({ invoiceOrder, onClick }) => {
  const { type, amount, date } = invoiceOrder;
  const cfg = typeTagStyles[type];
  return (
    <div
      className="p-4 rounded-xl border border-gray-100 bg-white cursor-pointer hover:border-emerald-200 hover:shadow-md transition-all"
      onClick={onClick}
      data-testid={`invoice-order-card-${type}`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex flex-col gap-1.5">
          <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border font-medium ${cfg.className}`}>
            <cfg.icon className="w-3 h-3" /> {cfg.label}
          </span>
          <p className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-gray-500" />
            {cfg.label} Invoice
          </p>
          {date && <p className="text-[11px] text-gray-500">Issued {formatDate(date)}</p>}
        </div>
        <ExternalLink className="w-4 h-4 text-gray-400 shrink-0" />
      </div>

      <div className="mb-2 px-3 py-2 bg-amber-50 rounded-lg">
        <p className="text-[11px] text-amber-800 font-medium">Tap to open the invoice</p>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-gray-50">
        <span className="text-sm text-gray-600">Awaiting payment</span>
        {amount != null && amount !== '' && (
          <span className="font-bold text-emerald-600">₹{Number(amount).toLocaleString('en-IN')}</span>
        )}
      </div>
    </div>
  );
};

// ---- Helpers ----
const buildInvoiceCardsFromLinks = (links, paidOrders) => {
  if (!links) return [];
  // Hide invoice-link "awaiting" cards once a real paid order exists for the same type.
  // Heuristic: if any inv_order was created (regardless of type), the invoice flow has converted.
  // For tighter behaviour later: match by invoice_id stored in user_purchase_links.
  const hasAnyPaid = (paidOrders || []).length > 0;
  const list = [];
  const types = [
    { type: 'medicine',  invKey: 'medicine_invoice_link',  amtKey: 'medicine_invoice_amount' },
    { type: 'injection', invKey: 'injection_invoice_link', amtKey: 'injection_invoice_amount' },
    { type: 'product',   invKey: 'product_invoice_link',   amtKey: 'product_invoice_amount' },
  ];
  types.forEach(({ type, invKey, amtKey }) => {
    const invLink = links[invKey];
    const amount = links[amtKey];
    const hasInvoice = invLink && String(invLink).trim() !== '';
    if (!hasInvoice) return;
    if (hasAnyPaid) return; // skip stale invoice cards once a paid order exists
    list.push({
      type, amount, date: links.updated_at,
      invoiceLink: invLink,
    });
  });
  return list;
};

// ---- Main component ----
const OrdersList = ({ compact = false }) => {
  const navigate = useNavigate();
  const [paidOrders, setPaidOrders] = useState([]);
  const [ecomOrders, setEcomOrders] = useState([]);
  const [invoiceCards, setInvoiceCards] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [paidRes, ecomRes, linksRes] = await Promise.allSettled([
        apiService.get('/api/inv/orders'),
        apiService.get('/api/orders'),
        apiService.get('/api/user/purchase-links'),
      ]);
      const paid = paidRes.status === 'fulfilled' ? (paidRes.value || []) : [];
      const ecom = ecomRes.status === 'fulfilled' ? (ecomRes.value || []) : [];
      const links = linksRes.status === 'fulfilled' ? linksRes.value : null;
      setPaidOrders(paid);
      setEcomOrders(ecom);
      setInvoiceCards(buildInvoiceCardsFromLinks(links, paid));
    } catch (error) {
      console.error('Failed to load unified orders:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleInvoiceCardClick = (inv) => {
    if (inv.invoiceLink) window.open(inv.invoiceLink, '_blank', 'noopener,noreferrer');
  };

  const totalItems = paidOrders.length + ecomOrders.length + invoiceCards.length;

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="p-4 rounded-xl bg-gray-50 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
            <div className="h-3 bg-gray-200 rounded w-1/2 mb-3" />
            <div className="h-8 bg-gray-200 rounded w-24" />
          </div>
        ))}
      </div>
    );
  }

  if (totalItems === 0) {
    return (
      <div className="text-center py-10" data-testid="orders-empty-state">
        <div className="w-20 h-20 mx-auto rounded-full bg-emerald-50 flex items-center justify-center mb-4">
          <ShoppingBag className="w-10 h-10 text-emerald-500" />
        </div>
        <h3 className="text-base font-semibold text-gray-800">No orders yet</h3>
        <p className="text-sm text-gray-500 mt-1">Your orders will appear here after payment is confirmed.</p>
        <button
          className="mt-5 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium"
          onClick={() => navigate('/home')}
          data-testid="start-shopping-btn"
        >
          Start Shopping
        </button>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${compact ? '' : ''}`} data-testid="orders-list">
      {paidOrders.map((o) => (
        <OrderCard key={o.order_id} order={o} />
      ))}
      {invoiceCards.map(inv => (
        <InvoiceCard
          key={`inv-${inv.type}`}
          invoiceOrder={inv}
          onClick={() => handleInvoiceCardClick(inv)}
        />
      ))}
      {ecomOrders.map(order => (
        <EcommerceCard
          key={order.id}
          order={order}
          onClick={() => navigate(`/order-confirmation/${order.id}`)}
        />
      ))}
    </div>
  );
};

export default OrdersList;
