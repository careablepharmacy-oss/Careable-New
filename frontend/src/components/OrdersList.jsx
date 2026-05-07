import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package, ChevronRight, ShoppingBag, Pill, Syringe, FileText, ExternalLink
} from 'lucide-react';
import apiService from '../services/api';
import TrackedOrdersPatient from './TrackedOrdersPatient';

// ---- Status colour maps ----
const deliveryStatusColors = {
  confirmed: 'bg-emerald-100 text-emerald-700',
  processing: 'bg-blue-100 text-blue-700',
  shipped: 'bg-purple-100 text-purple-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  pending: 'bg-yellow-100 text-yellow-700',
  awaiting: 'bg-amber-100 text-amber-700',
};

const paymentStatusColors = {
  paid: 'bg-emerald-100 text-emerald-700',
  pending: 'bg-yellow-100 text-yellow-700',
  failed: 'bg-red-100 text-red-700',
};

// ---- Order type tag definition ----
const typeTagStyles = {
  product: {
    label: 'Product',
    icon: ShoppingBag,
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  medicine: {
    label: 'Medicine',
    icon: Pill,
    className: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  injection: {
    label: 'Injection',
    icon: Syringe,
    className: 'bg-purple-50 text-purple-700 border-purple-200',
  },
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (isNaN(d)) return '';
  return d.toLocaleDateString('en-IN', {
    year: 'numeric', month: 'short', day: 'numeric'
  });
};

const titleCase = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

// ---- Sub-components ----
const TypeTag = ({ type }) => {
  const cfg = typeTagStyles[type] || typeTagStyles.product;
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border font-medium ${cfg.className}`}
      data-testid={`order-type-tag-${type}`}
    >
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
};

const StatusBadge = ({ label, value, colorClass }) => (
  <div className="flex items-center gap-1.5">
    <span className="text-[10px] uppercase tracking-wide text-gray-500 font-medium">{label}</span>
    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${colorClass}`}>
      {value}
    </span>
  </div>
);

const EcommerceCard = ({ order, onClick }) => {
  const paymentKey = order.payment_status || 'pending';
  const deliveryKey = order.order_status || 'pending';
  const paymentLabel = paymentKey === 'paid' ? 'Paid' : paymentKey === 'failed' ? 'Failed' : 'Pending';
  return (
    <div
      className="p-4 rounded-xl border border-gray-100 bg-white cursor-pointer hover:border-emerald-200 hover:shadow-md transition-all"
      onClick={onClick}
      data-testid={`order-card-${order.id}`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex flex-col gap-1.5">
          <TypeTag type="product" />
          <p className="font-bold text-gray-900 text-sm">{order.order_number}</p>
          <p className="text-[11px] text-gray-500">{formatDate(order.created_at)}</p>
        </div>
        <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 my-3">
        <StatusBadge
          label="Payment"
          value={paymentLabel}
          colorClass={paymentStatusColors[paymentKey] || paymentStatusColors.pending}
        />
        <StatusBadge
          label="Delivery"
          value={titleCase(deliveryKey)}
          colorClass={deliveryStatusColors[deliveryKey] || deliveryStatusColors.pending}
        />
      </div>

      {order.tracking_number && (
        <div className="mb-3 px-3 py-2 bg-blue-50 rounded-lg">
          <p className="text-xs text-blue-700 font-medium">Tracking: {order.tracking_number}</p>
        </div>
      )}

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

const InvoiceCard = ({ invoiceOrder, onClick }) => {
  const { type, amount, date, hasOrderLink } = invoiceOrder;
  const cfg = typeTagStyles[type];
  return (
    <div
      className="p-4 rounded-xl border border-gray-100 bg-white cursor-pointer hover:border-emerald-200 hover:shadow-md transition-all"
      onClick={onClick}
      data-testid={`invoice-order-card-${type}`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex flex-col gap-1.5">
          <TypeTag type={type} />
          <p className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-gray-500" />
            {cfg.label} Invoice
          </p>
          {date && <p className="text-[11px] text-gray-500">Issued on {formatDate(date)}</p>}
        </div>
        <ExternalLink className="w-4 h-4 text-gray-400 shrink-0" />
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 my-3">
        <StatusBadge
          label="Payment"
          value="Pending"
          colorClass={paymentStatusColors.pending}
        />
        <StatusBadge
          label="Delivery"
          value={hasOrderLink ? 'Awaiting Order' : 'Invoice Issued'}
          colorClass={deliveryStatusColors.awaiting}
        />
      </div>

      <div className="mb-2 px-3 py-2 bg-amber-50 rounded-lg">
        <p className="text-[11px] text-amber-800 font-medium">
          Tap to open {hasOrderLink ? 'your order link' : 'the invoice'} from your prescription manager
        </p>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-gray-50">
        <div className="flex items-center gap-1.5">
          <FileText className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-600">1 invoice</span>
        </div>
        {amount != null && amount !== '' && (
          <span className="font-bold text-emerald-600">
            ₹{Number(amount).toLocaleString('en-IN')}
          </span>
        )}
      </div>
    </div>
  );
};

// ---- Helpers ----
const buildInvoiceOrders = (links) => {
  if (!links) return [];
  const list = [];
  const types = [
    { type: 'medicine', orderKey: 'medicine_order_link', invKey: 'medicine_invoice_link', amtKey: 'medicine_invoice_amount' },
    { type: 'injection', orderKey: 'injection_order_link', invKey: 'injection_invoice_link', amtKey: 'injection_invoice_amount' },
    { type: 'product', orderKey: 'product_order_link', invKey: 'product_invoice_link', amtKey: 'product_invoice_amount' },
  ];
  types.forEach(({ type, orderKey, invKey, amtKey }) => {
    const orderLink = links[orderKey];
    const invLink = links[invKey];
    const amount = links[amtKey];
    // Only show if there's an invoice link OR an order link with an amount
    // (skip completely empty rows)
    const hasInvoice = invLink && String(invLink).trim() !== '';
    const hasOrderLink = orderLink && String(orderLink).trim() !== '';
    if (!hasInvoice && !hasOrderLink) return;
    list.push({
      type,
      amount,
      date: links.updated_at,
      orderLink: hasOrderLink ? orderLink : null,
      invoiceLink: hasInvoice ? invLink : null,
      hasOrderLink,
    });
  });
  return list;
};

// ---- Main component ----
const OrdersList = ({ compact = false }) => {
  const navigate = useNavigate();
  const [ecomOrders, setEcomOrders] = useState([]);
  const [invoiceOrders, setInvoiceOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [ordersRes, linksRes] = await Promise.allSettled([
        apiService.get('/api/orders'),
        apiService.get('/api/user/purchase-links'),
      ]);
      setEcomOrders(ordersRes.status === 'fulfilled' ? (ordersRes.value || []) : []);
      const links = linksRes.status === 'fulfilled' ? linksRes.value : null;
      setInvoiceOrders(buildInvoiceOrders(links));
    } catch (error) {
      console.error('Failed to load unified orders:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleInvoiceOrderClick = (inv) => {
    const url = inv.orderLink || inv.invoiceLink;
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const totalItems = ecomOrders.length + invoiceOrders.length;

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
      <div className="space-y-4">
        <TrackedOrdersPatient />
        <div className="text-center py-10" data-testid="orders-empty-state">
          <div className="w-20 h-20 mx-auto rounded-full bg-emerald-50 flex items-center justify-center mb-4">
            <ShoppingBag className="w-10 h-10 text-emerald-500" />
          </div>
          <h3 className="text-base font-semibold text-gray-800">No orders yet</h3>
          <p className="text-sm text-gray-500 mt-1">Start shopping to see your orders here</p>
          <button
            className="mt-5 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium"
            onClick={() => navigate('/home')}
            data-testid="start-shopping-btn"
          >
            Start Shopping
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${compact ? '' : ''}`}>
      <TrackedOrdersPatient />
      <div className="space-y-3">
        {invoiceOrders.map(inv => (
          <InvoiceCard
            key={`inv-${inv.type}`}
            invoiceOrder={inv}
            onClick={() => handleInvoiceOrderClick(inv)}
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
    </div>
  );
};

export default OrdersList;
