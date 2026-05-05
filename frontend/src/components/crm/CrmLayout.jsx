import { useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Target,
  FlaskConical,
  FileBarChart,
  Menu,
  X,
  Heart,
  RefreshCw,
  ArrowLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { syncFromMainApp } from "@/lib/crmApi";

const navItems = [
  { path: "/crm", icon: LayoutDashboard, label: "Dashboard", end: true },
  { path: "/crm/patients", icon: Users, label: "Patients" },
  { path: "/crm/opportunities", icon: Target, label: "Opportunities" },
  { path: "/crm/lab-tests", icon: FlaskConical, label: "Lab Tests" },
  { path: "/crm/lab-reconciliation", icon: FileBarChart, label: "Lab Reconciliation" },
];

export default function CrmLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const navigate = useNavigate();

  const handleSync = async () => {
    try {
      setSyncing(true);
      const { data } = await syncFromMainApp();
      toast.success(`Sync complete: ${data.created} new patient(s). ${data.total_profiles} total in CRM.`);
    } catch (err) {
      toast.error("Sync failed: " + (err?.response?.data?.detail || err.message));
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gradient-to-r from-[#1E3A5F] via-[#2BA89F] to-[#7AB648] shadow-md" data-testid="main-header">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden text-white hover:bg-white/20"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              data-testid="mobile-menu-button"
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <Heart className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-white font-bold text-lg tracking-tight">
                  Careable 360+ CRM
                </h1>
                <p className="text-white/70 text-xs">Healthcare Assistant Portal</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/20 gap-1"
              onClick={handleSync}
              disabled={syncing}
              data-testid="crm-sync-button"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{syncing ? 'Syncing…' : 'Sync Users'}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/20 gap-1"
              onClick={() => navigate('/prescription-manager')}
              data-testid="crm-back-to-pm"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">PM Dashboard</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`
            fixed lg:sticky top-[60px] left-0 z-40 h-[calc(100vh-60px)] w-64 bg-white border-r border-slate-100
            transform transition-transform duration-200 ease-in-out
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          `}
          data-testid="sidebar"
        >
          <nav className="p-4 space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `sidebar-link flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors
                  ${isActive
                    ? "active text-teal-700 bg-teal-50"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`
                }
                data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </NavLink>
            ))}
          </nav>
          
          {/* Assistant Info */}
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#2BA89F] to-[#1E3A5F] flex items-center justify-center text-white font-semibold">
                HA
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">Healthcare Assistant</p>
                <p className="text-xs text-slate-500">Online</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <main className="flex-1 p-4 lg:p-6 min-h-[calc(100vh-60px)]" data-testid="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
