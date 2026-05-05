import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, FileText, PlusCircle, Tag, Settings, Package,
  CreditCard, Truck, Menu, X, ArrowLeft, ChevronDown, Stethoscope
} from 'lucide-react';

const NAV_ITEMS = [
  { to: '/invoice-manager', icon: LayoutDashboard, label: 'Dashboard', end: true },
  {
    label: 'Invoices', icon: FileText, children: [
      { to: '/invoice-manager/invoices', label: 'All Invoices' },
      { to: '/invoice-manager/invoices/create', label: 'Create Invoice' },
    ]
  },
  {
    label: 'Monitoring', icon: CreditCard, children: [
      { to: '/invoice-manager/cod-monitor', label: 'COD Monitor' },
      { to: '/invoice-manager/online-monitor', label: 'Online Monitor' },
    ]
  },
  { to: '/invoice-manager/orders', icon: Truck, label: 'Orders' },
  { to: '/invoice-manager/coupons', icon: Tag, label: 'Coupons' },
  { to: '/invoice-manager/settings', icon: Settings, label: 'Settings' },
];

const linkClass = ({ isActive }) =>
  `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
    isActive
      ? 'bg-emerald-50 text-emerald-700 font-semibold'
      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
  }`;

function NavItem({ item }) {
  const [open, setOpen] = useState(false);
  if (item.children) {
    return (
      <div>
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-all duration-200"
          data-testid={`inv-nav-${item.label.toLowerCase()}-toggle`}
        >
          <span className="flex items-center gap-3">
            <item.icon className="w-4 h-4" />
            {item.label}
          </span>
          <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <div className="ml-7 mt-1 space-y-1">
            {item.children.map((child) => (
              <NavLink key={child.to} to={child.to} end className={linkClass} data-testid={`inv-nav-${child.label.toLowerCase().replace(/\s/g, '-')}`}>
                {child.label}
              </NavLink>
            ))}
          </div>
        )}
      </div>
    );
  }
  return (
    <NavLink to={item.to} end={item.end} className={linkClass} data-testid={`inv-nav-${item.label.toLowerCase()}`}>
      <item.icon className="w-4 h-4" />
      {item.label}
    </NavLink>
  );
}

export default function InvoiceLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:sticky top-0 left-0 z-50 h-screen w-64 bg-white border-r border-gray-100
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
        flex flex-col
      `}>
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Invoice Manager</h2>
              <p className="text-xs text-gray-500">Manage invoices & delivery</p>
            </div>
            <button className="lg:hidden p-1" onClick={() => setSidebarOpen(false)}>
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto" onClick={() => setSidebarOpen(false)}>
          {NAV_ITEMS.map((item) => (
            <NavItem key={item.label} item={item} />
          ))}
        </nav>
        <div className="p-3 border-t border-gray-100 space-y-1">
          <button
            onClick={() => navigate('/crm')}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 transition-all"
            data-testid="inv-go-to-crm"
          >
            <Stethoscope className="w-4 h-4" />
            Go to CRM
          </button>
          <button
            onClick={() => navigate('/prescription-manager')}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all"
            data-testid="inv-back-to-pm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to PM Dashboard
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-30 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
          <button onClick={() => setSidebarOpen(true)} data-testid="inv-mobile-menu">
            <Menu className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-base font-semibold text-gray-900 flex-1">Invoice Manager</h1>
          <button
            onClick={() => navigate('/crm')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 transition-all"
            data-testid="inv-go-to-crm-mobile"
          >
            <Stethoscope className="w-3.5 h-3.5" />
            CRM
          </button>
        </header>
        <main className="p-4 lg:p-6 max-w-7xl mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
