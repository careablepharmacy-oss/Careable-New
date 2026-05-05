import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  Target,
  Pill,
  FlaskConical,
  ShoppingBag,
  Activity,
  AlertTriangle,
  Phone,
  Check,
  X,
  RefreshCw,
  IndianRupee,
  Filter,
  ChevronRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  getOpportunities,
  updateOpportunity,
  generateOpportunities
} from "@/lib/crmApi";

const OPPORTUNITY_TYPES = [
  { value: "all", label: "All Types", icon: Target },
  { value: "refill", label: "Medicine Refills", icon: Pill },
  { value: "lab_test", label: "Lab Tests", icon: FlaskConical },
  { value: "product", label: "Products", icon: ShoppingBag },
  { value: "invoice", label: "Invoice Follow-ups", icon: IndianRupee },
  { value: "adherence", label: "Adherence", icon: AlertTriangle }
];

export default function Opportunities() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState(searchParams.get("type") || "all");
  const [statusFilter, setStatusFilter] = useState("pending");

  const fetchOpportunities = async () => {
    setLoading(true);
    try {
      const params = { status: statusFilter };
      const res = await getOpportunities(params);
      setOpportunities(res.data);
    } catch (error) {
      toast.error("Failed to fetch opportunities");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOpportunities();
  }, [statusFilter]);

  // Update typeFilter when URL search params change (e.g., from Dashboard Quick Actions)
  useEffect(() => {
    const urlType = searchParams.get("type");
    if (urlType && urlType !== typeFilter) {
      setTypeFilter(urlType);
    }
  }, [searchParams]);

  // Filtered list for display
  const filteredOpportunities = typeFilter === "all"
    ? opportunities
    : opportunities.filter(opp => opp.type === typeFilter);

  const handleRefresh = async () => {
    try {
      await generateOpportunities();
      toast.success("Opportunities refreshed!");
      fetchOpportunities();
    } catch (error) {
      toast.error("Failed to refresh opportunities");
    }
  };

  const handleUpdateStatus = async (id, status) => {
    try {
      await updateOpportunity(id, { status });
      toast.success(`Opportunity marked as ${status}`);
      fetchOpportunities();
    } catch (error) {
      toast.error("Failed to update opportunity");
    }
  };

  const getTypeIcon = (type) => {
    const typeConfig = OPPORTUNITY_TYPES.find(t => t.value === type);
    return typeConfig?.icon || Target;
  };

  const getTypeColor = (type) => {
    const colors = {
      refill: "bg-red-100 text-red-600",
      lab_test: "bg-purple-100 text-purple-600",
      product: "bg-orange-100 text-orange-600",
      vitals_alert: "bg-pink-100 text-pink-600",
      adherence: "bg-green-100 text-green-600"
    };
    return colors[type] || "bg-slate-100 text-slate-600";
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "high": return "bg-red-100 text-red-700";
      case "medium": return "bg-orange-100 text-orange-700";
      default: return "bg-green-100 text-green-700";
    }
  };

  // Calculate totals
  const totalRevenue = opportunities.reduce((sum, opp) => sum + (opp.expected_revenue || 0), 0);
  const highPriorityCount = opportunities.filter(opp => opp.priority === "high").length;

  // Group by type for summary
  const typeCounts = opportunities.reduce((acc, opp) => {
    acc[opp.type] = (acc[opp.type] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6" data-testid="opportunities-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Opportunities</h1>
          <p className="text-slate-500 text-sm">
            {filteredOpportunities.length}{typeFilter !== "all" ? ` of ${opportunities.length}` : ""} opportunities • ₹{totalRevenue.toLocaleString('en-IN')} potential revenue
          </p>
        </div>
        <Button onClick={handleRefresh} className="gradient-teal text-white" data-testid="refresh-opportunities-btn">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh Opportunities
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {OPPORTUNITY_TYPES.slice(1).map((type, i) => (
          <Card
            key={type.value}
            className={`cursor-pointer transition-all ${typeFilter === type.value ? 'ring-2 ring-teal-500' : ''}`}
            onClick={() => setTypeFilter(type.value === typeFilter ? 'all' : type.value)}
            data-testid={`filter-${type.value}`}
          >
            <CardContent className="p-4 text-center">
              <div className={`w-10 h-10 mx-auto rounded-lg ${getTypeColor(type.value)} flex items-center justify-center mb-2`}>
                <type.icon className="h-5 w-5" />
              </div>
              <p className="text-2xl font-bold text-slate-900 tabular-nums">{typeCounts[type.value] || 0}</p>
              <p className="text-xs text-slate-500">{type.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Revenue Summary */}
      <Card className="gradient-coral text-white">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-white/80 text-sm">Expected Revenue from Pending Opportunities</p>
              <p className="text-4xl font-bold tabular-nums">₹{totalRevenue.toLocaleString('en-IN')}</p>
            </div>
            <div className="flex gap-6">
              <div className="text-center">
                <p className="text-3xl font-bold tabular-nums">{highPriorityCount}</p>
                <p className="text-white/80 text-sm">High Priority</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold tabular-nums">{opportunities.length}</p>
                <p className="text-white/80 text-sm">Total</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px]" data-testid="type-filter-select">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                {OPPORTUNITY_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]" data-testid="status-filter-select">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="contacted">Contacted</SelectItem>
                <SelectItem value="converted">Converted</SelectItem>
                <SelectItem value="dismissed">Dismissed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Opportunities List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-teal-600" />
        </div>
      ) : filteredOpportunities.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Target className="h-16 w-16 mx-auto mb-4 text-slate-300" />
            <h3 className="text-lg font-semibold text-slate-700">No opportunities found</h3>
            <p className="text-slate-500 mt-1">Try changing the filters or refresh to generate new opportunities</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredOpportunities.map((opp, i) => {
            const TypeIcon = getTypeIcon(opp.type);
            return (
              <Card
                key={opp.id}
                className={`opp-${opp.type} hover:shadow-md transition-shadow`}
                data-testid={`opportunity-card-${i}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Type Icon */}
                    <div className={`p-3 rounded-xl ${getTypeColor(opp.type)}`}>
                      <TypeIcon className="h-6 w-6" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link to={`/crm/patients/${opp.patient_id}`}>
                          <span className="font-semibold text-slate-900 hover:text-teal-600 transition-colors">
                            {opp.patient_name}
                          </span>
                        </Link>
                        <Badge variant="outline" className={getPriorityColor(opp.priority)}>
                          {opp.priority}
                        </Badge>
                        {opp.revenue_category && (
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-semibold uppercase tracking-wider ${opp.revenue_category === "lab_test" ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-teal-50 text-teal-700 border-teal-200"}`}
                            data-testid={`revenue-category-${i}`}
                          >
                            {opp.revenue_category === "lab_test" ? "Lab Tests" : "Invoice Follow-up"}
                          </Badge>
                        )}
                        <Badge variant="outline" className="bg-slate-100 text-slate-600 capitalize">
                          {opp.type.replace('_', ' ')}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-600 mt-1">{opp.description}</p>
                      {opp.expected_revenue > 0 && (
                        <p className="text-sm font-medium text-green-600 mt-1 flex items-center gap-1">
                          <IndianRupee className="h-3 w-3" />
                          {opp.expected_revenue.toLocaleString('en-IN')} expected
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-green-600 border-green-200 hover:bg-green-50"
                        onClick={() => handleUpdateStatus(opp.id, 'converted')}
                        data-testid={`convert-opp-${i}`}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-slate-500 border-slate-200 hover:bg-slate-50"
                        onClick={() => handleUpdateStatus(opp.id, 'dismissed')}
                        data-testid={`dismiss-opp-${i}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <Link to={`/crm/patients/${opp.patient_id}`}>
                        <Button size="sm" variant="outline" className="text-teal-600 border-teal-200 hover:bg-[#2BA89F]/10" data-testid={`view-patient-${i}`}>
                          View
                        </Button>
                      </Link>
                      <Button
                        size="sm"
                        className="gradient-teal text-white disabled:opacity-50"
                        disabled={!opp.patient_phone}
                        onClick={() => {
                          if (opp.patient_phone) {
                            window.location.href = `tel:${opp.patient_phone}`;
                          }
                        }}
                        data-testid={`call-opp-${i}`}
                        title={opp.patient_phone ? `Call ${opp.patient_phone}` : "No phone number on file"}
                      >
                        <Phone className="h-4 w-4 mr-1" />
                        Call
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
