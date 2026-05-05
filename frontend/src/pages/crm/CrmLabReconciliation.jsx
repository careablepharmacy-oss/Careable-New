import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  FlaskConical,
  Building2,
  Stethoscope,
  Calendar,
  IndianRupee,
  Download,
  RefreshCw,
  FileText,
  ChevronRight,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { getLabReconciliation, getLabReconciliationDetails } from "@/lib/crmApi";

const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Cohesive palette aligned with teal/coral theme
const CHART_COLORS = [
  "#14b8a6", // teal-500
  "#f97316", // orange-500
  "#6366f1", // indigo-500
  "#a855f7", // purple-500
  "#ec4899", // pink-500
  "#f59e0b", // amber-500
  "#22c55e", // green-500
  "#0ea5e9", // sky-500
  "#e11d48", // rose-600
  "#64748b", // slate-500
];

const formatInr = (n) =>
  `₹${(Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const toCsvCell = (v) => {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export default function LabReconciliation() {
  const now = new Date();
  const [period, setPeriod] = useState("month"); // month | ytd
  const [month, setMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  );
  const [year, setYear] = useState(now.getFullYear());
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  // Detail modal state
  const [detail, setDetail] = useState(null); // { group_by, value, label }
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState(null);

  const openDetail = async (group_by, value, groupLabel) => {
    setDetail({ group_by, value, label: groupLabel });
    setDetailData(null);
    setDetailLoading(true);
    try {
      const params =
        period === "ytd"
          ? { period, year, group_by, value }
          : { period, month, group_by, value };
      const res = await getLabReconciliationDetails(params);
      setDetailData(res.data);
    } catch {
      toast.error("Failed to load details");
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setDetail(null);
    setDetailData(null);
  };

  const exportDetailCsv = () => {
    if (!detailData || !detailData.bookings || detailData.bookings.length === 0) {
      toast.info("No rows to export");
      return;
    }
    const header = ["Booked Date", "Patient", "Test", "Lab", "Diseases", "Status", "Source", "Amount (₹)"];
    const body = detailData.bookings.map((b) => [
      b.booked_date,
      b.patient_name,
      b.test_name,
      b.lab_name,
      (b.diseases || []).join("; "),
      b.status,
      b.source,
      (b.price || 0).toFixed(2),
    ]);
    const csv = [header, ...body].map((row) => row.map(toCsvCell).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lab-recon-detail-${detail?.group_by}-${detail?.value}-${(detailData?.range?.start || "")}_${(detailData?.range?.end || "")}.csv`
      .replace(/\s+/g, "_");
    a.click();
    URL.revokeObjectURL(url);
  };

  const yearOptions = useMemo(() => {
    const y = now.getFullYear();
    return [y, y - 1, y - 2];
  }, [now]);

  const monthOptions = useMemo(() => {
    // Last 24 months
    const arr = [];
    const y0 = now.getFullYear();
    const m0 = now.getMonth();
    for (let i = 0; i < 24; i++) {
      const d = new Date(y0, m0 - i, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`;
      arr.push({ value, label });
    }
    return arr;
  }, [now]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = period === "ytd" ? { period, year } : { period, month };
      const res = await getLabReconciliation(params);
      setData(res.data);
    } catch {
      toast.error("Failed to load lab reconciliation data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // deps: fetchData depends on period/month/year via closure; re-run when they change
  }, [period, month, year]);

  const periodLabel = useMemo(() => {
    if (!data) return "";
    if (data.period === "ytd") return `YTD ${data.year}`;
    const parts = (data.month || "").split("-");
    if (parts.length === 2) {
      const m = parseInt(parts[1], 10) - 1;
      return `${MONTH_LABELS[m] || ""} ${parts[0]}`;
    }
    return data.month || "";
  }, [data]);

  const downloadCsv = (rows, groupLabel) => {
    if (!rows || rows.length === 0) {
      toast.info("No rows to export");
      return;
    }
    const hasDiseases = rows.some((r) => Array.isArray(r.diseases));
    const header = hasDiseases
      ? [groupLabel, "Tests", "Amount (₹)", "Diseases"]
      : [groupLabel, "Tests", "Amount (₹)"];
    const body = rows.map((r) =>
      hasDiseases
        ? [r.label, r.count, (r.amount || 0).toFixed(2), (r.diseases || []).join("; ")]
        : [r.label, r.count, (r.amount || 0).toFixed(2)]
    );
    const csv = [header, ...body].map((row) => row.map(toCsvCell).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lab-reconciliation-${groupLabel.toLowerCase()}-${periodLabel.replace(/\s+/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderBreakdown = (rows, groupLabel, icon, testidPrefix, showDiseases = false, groupByKey = "") => {
    const totalAmount = rows?.reduce((s, r) => s + (r.amount || 0), 0) || 0;
    const totalCount = rows?.reduce((s, r) => s + (r.count || 0), 0) || 0;
    return (
      <Card data-testid={`${testidPrefix}-card`}>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-teal-50 text-teal-600">{icon}</div>
            <div>
              <CardTitle className="text-base font-semibold">
                Breakdown by {groupLabel}
              </CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                {rows?.length || 0} unique {groupLabel.toLowerCase()}{rows?.length === 1 ? "" : "s"} • {totalCount} test{totalCount === 1 ? "" : "s"} • {formatInr(totalAmount)}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadCsv(rows, groupLabel)}
            data-testid={`${testidPrefix}-export-btn`}
            disabled={!rows || rows.length === 0}
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export CSV
          </Button>
        </CardHeader>
        <CardContent>
          {!rows || rows.length === 0 ? (
            <div className="text-center py-10 text-slate-400" data-testid={`${testidPrefix}-empty`}>
              <FileText className="h-10 w-10 mx-auto mb-2 text-slate-300" />
              <p className="text-sm">No bookings in this period.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid={`${testidPrefix}-table`}>
                <thead>
                  <tr className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider border-b border-slate-100">
                    <th className="py-2 pr-3">{groupLabel}</th>
                    {showDiseases && <th className="py-2 px-3">Linked Diseases</th>}
                    <th className="py-2 px-3 text-right">Tests</th>
                    <th className="py-2 px-3 text-right">Amount</th>
                    <th className="py-2 pl-3 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r, i) => {
                    const share = totalAmount > 0 ? ((r.amount || 0) / totalAmount) * 100 : 0;
                    return (
                      <tr
                        key={i}
                        data-testid={`${testidPrefix}-row-${i}`}
                        className="hover:bg-[#2BA89F]/10/50 cursor-pointer transition-colors group"
                        onClick={() => groupByKey && openDetail(groupByKey, r.label, groupLabel)}
                      >
                        <td className="py-3 pr-3 font-medium text-slate-800 group-hover:text-teal-700">{r.label}</td>
                        {showDiseases && (
                          <td className="py-3 px-3">
                            <div className="flex flex-wrap gap-1.5">
                              {(r.diseases || []).length === 0 ? (
                                <span className="text-xs text-slate-400">—</span>
                              ) : (
                                r.diseases.map((d, di) => (
                                  <Badge
                                    key={di}
                                    variant="outline"
                                    className="bg-slate-50 border-slate-200 text-slate-600 text-[10px]"
                                  >
                                    {d}
                                  </Badge>
                                ))
                              )}
                            </div>
                          </td>
                        )}
                        <td className="py-3 px-3 text-right tabular-nums text-slate-700">{r.count}</td>
                        <td className="py-3 px-3 text-right tabular-nums">
                          <div className="flex items-center justify-end gap-2">
                            <span className="font-semibold text-slate-900">{formatInr(r.amount)}</span>
                            <span className="text-[10px] text-slate-400 w-10 text-left">{share.toFixed(1)}%</span>
                          </div>
                        </td>
                        <td className="py-3 pl-1 text-right">
                          <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-teal-500 group-hover:translate-x-0.5 transition" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t border-slate-200">
                  <tr className="text-xs uppercase tracking-wider text-slate-500">
                    <td className="py-2 pr-3 font-semibold">Total</td>
                    {showDiseases && <td />}
                    <td className="py-2 px-3 text-right tabular-nums font-semibold text-slate-700">{totalCount}</td>
                    <td className="py-2 px-3 text-right tabular-nums font-bold text-slate-900">
                      {formatInr(totalAmount)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6" data-testid="lab-reconciliation-page">
      {/* Header */}
      <div className="rounded-2xl p-6 gradient-teal text-white">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FlaskConical className="h-6 w-6" />
              Lab Test Reconciliation
            </h1>
            <p className="text-white/80 mt-1 text-sm max-w-xl">
              Track, analyse and reconcile all lab tests booked through the platform. Slice data by lab, test or associated disease for monthly or year-to-date views.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3" data-testid="lab-recon-filters">
            <div>
              <Label className="text-white/80 text-xs">Period</Label>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="w-36 bg-white text-slate-700" data-testid="lab-recon-period-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Monthly</SelectItem>
                  <SelectItem value="ytd">Year-to-Date</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {period === "month" ? (
              <div>
                <Label className="text-white/80 text-xs">Month</Label>
                <Select value={month} onValueChange={setMonth}>
                  <SelectTrigger className="w-48 bg-white text-slate-700" data-testid="lab-recon-month-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {monthOptions.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div>
                <Label className="text-white/80 text-xs">Year</Label>
                <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v, 10))}>
                  <SelectTrigger className="w-32 bg-white text-slate-700" data-testid="lab-recon-year-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button
              variant="outline"
              className="border-white/40 text-white bg-white/10 hover:bg-white/20"
              onClick={fetchData}
              disabled={loading}
              data-testid="lab-recon-refresh-btn"
            >
              <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4" data-testid="lab-recon-summary">
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-teal-50 text-teal-600">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider">Period</p>
              <p className="text-lg font-semibold text-slate-900" data-testid="summary-period">{periodLabel || "—"}</p>
              {data?.range && (
                <p className="text-[11px] text-slate-400">
                  {data.range.start} → {data.range.end}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-purple-50 text-purple-600">
              <FlaskConical className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider">Total Tests Booked</p>
              <p className="text-2xl font-bold text-slate-900 tabular-nums" data-testid="summary-total-count">
                {data?.totals?.count ?? 0}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-green-50 text-green-600">
              <IndianRupee className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider">Total Amount</p>
              <p className="text-2xl font-bold text-slate-900 tabular-nums" data-testid="summary-total-amount">
                {formatInr(data?.totals?.amount || 0)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Breakdown tabs */}
      <Tabs defaultValue="lab" className="w-full" data-testid="lab-recon-tabs">
        <TabsList>
          <TabsTrigger value="lab" data-testid="tab-lab">
            <Building2 className="h-4 w-4 mr-1.5" /> Lab-wise
          </TabsTrigger>
          <TabsTrigger value="test" data-testid="tab-test">
            <FlaskConical className="h-4 w-4 mr-1.5" /> Test-wise
          </TabsTrigger>
          <TabsTrigger value="disease" data-testid="tab-disease">
            <Stethoscope className="h-4 w-4 mr-1.5" /> Disease-wise
          </TabsTrigger>
        </TabsList>
        <TabsContent value="lab" className="mt-4 space-y-4">
          {renderBreakdown(data?.by_lab, "Lab", <Building2 className="h-5 w-5" />, "by-lab", false, "lab")}
          {/* Pie chart showing per-lab contribution */}
          {data?.by_lab && data.by_lab.length > 0 && (
            <Card data-testid="by-lab-pie-card">
              <CardHeader>
                <CardTitle className="text-base font-semibold">
                  Laboratory Contribution
                </CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">
                  Share of total revenue by laboratory · click any slice or row above for details
                </p>
              </CardHeader>
              <CardContent>
                <div className="w-full h-[320px]" data-testid="by-lab-pie-chart">
                  <ResponsiveContainer width="100%" height="100%" minWidth={300} minHeight={300}>
                    <PieChart>
                      <Pie
                        data={data.by_lab.map((r) => ({
                          name: r.label,
                          value: r.amount,
                          count: r.count,
                        }))}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={115}
                        paddingAngle={2}
                        stroke="#ffffff"
                        strokeWidth={2}
                        onClick={(e) => {
                          if (e && e.name) openDetail("lab", e.name, "Lab");
                        }}
                        cursor="pointer"
                      >
                        {data.by_lab.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <ChartTooltip
                        formatter={(value, name, entry) => [
                          `${formatInr(value)} · ${entry?.payload?.count || 0} test${(entry?.payload?.count || 0) === 1 ? "" : "s"}`,
                          name,
                        ]}
                        contentStyle={{
                          borderRadius: 8,
                          border: "1px solid #e2e8f0",
                          fontSize: 12,
                        }}
                      />
                      <Legend
                        verticalAlign="bottom"
                        iconType="circle"
                        wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        <TabsContent value="test" className="mt-4">
          {renderBreakdown(data?.by_test, "Test", <FlaskConical className="h-5 w-5" />, "by-test", true, "test")}
        </TabsContent>
        <TabsContent value="disease" className="mt-4">
          {renderBreakdown(data?.by_disease, "Disease", <Stethoscope className="h-5 w-5" />, "by-disease", false, "disease")}
        </TabsContent>
      </Tabs>

      {/* Detail Dialog */}
      <Dialog open={!!detail} onOpenChange={(open) => { if (!open) closeDetail(); }}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col" data-testid="lab-recon-detail-dialog">
          <DialogHeader className="shrink-0 border-b pb-3">
            <DialogTitle className="flex items-center gap-2">
              {detail?.group_by === "lab" && <Building2 className="h-5 w-5 text-teal-600" />}
              {detail?.group_by === "test" && <FlaskConical className="h-5 w-5 text-teal-600" />}
              {detail?.group_by === "disease" && <Stethoscope className="h-5 w-5 text-teal-600" />}
              <span>{detail?.label}: <span className="font-normal text-slate-500">{detail?.value}</span></span>
            </DialogTitle>
            {detailData && (
              <p className="text-xs text-slate-500 mt-1" data-testid="detail-summary">
                {detailData.count} booking{detailData.count === 1 ? "" : "s"} · {formatInr(detailData.total_amount)}
                {" · "}
                <span className="text-slate-400">{detailData.range?.start} → {detailData.range?.end}</span>
              </p>
            )}
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto py-3">
            {detailLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-6 w-6 animate-spin text-teal-600" />
              </div>
            ) : !detailData || detailData.bookings.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <FileText className="h-10 w-10 mx-auto mb-2 text-slate-300" />
                <p className="text-sm">No bookings found.</p>
              </div>
            ) : (
              <table className="w-full text-sm" data-testid="detail-table">
                <thead>
                  <tr className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider border-b border-slate-100 sticky top-0 bg-white">
                    <th className="py-2 pr-3">Date</th>
                    <th className="py-2 px-3">Patient</th>
                    <th className="py-2 px-3">Test</th>
                    {detail?.group_by !== "lab" && <th className="py-2 px-3">Lab</th>}
                    {detail?.group_by !== "disease" && <th className="py-2 px-3">Diseases</th>}
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 pl-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {detailData.bookings.map((b, i) => (
                    <tr key={b.id || i} data-testid={`detail-row-${i}`}>
                      <td className="py-2.5 pr-3 text-slate-600 tabular-nums whitespace-nowrap">{b.booked_date}</td>
                      <td className="py-2.5 px-3 font-medium text-slate-800">{b.patient_name}</td>
                      <td className="py-2.5 px-3 text-slate-700">{b.test_name}</td>
                      {detail?.group_by !== "lab" && (
                        <td className="py-2.5 px-3 text-slate-600">{b.lab_name}</td>
                      )}
                      {detail?.group_by !== "disease" && (
                        <td className="py-2.5 px-3">
                          <div className="flex flex-wrap gap-1">
                            {(b.diseases || []).map((d, di) => (
                              <Badge key={di} variant="outline" className="bg-slate-50 border-slate-200 text-slate-600 text-[10px]">
                                {d}
                              </Badge>
                            ))}
                          </div>
                        </td>
                      )}
                      <td className="py-2.5 px-3">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            b.status === "completed" ? "bg-green-50 border-green-200 text-green-700" :
                            b.status === "cancelled" ? "bg-red-50 border-red-200 text-red-700" :
                            "bg-amber-50 border-amber-200 text-amber-700"
                          }`}
                        >
                          {b.status}
                        </Badge>
                      </td>
                      <td className="py-2.5 pl-3 text-right font-semibold text-slate-900 tabular-nums">{formatInr(b.price)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-slate-200">
                  <tr className="text-xs uppercase tracking-wider text-slate-500">
                    <td colSpan={detail?.group_by === "lab" ? 4 : (detail?.group_by === "disease" ? 4 : 5)} className="py-2 pr-3 font-semibold">Total</td>
                    <td className="py-2 pl-3 text-right tabular-nums font-bold text-slate-900" data-testid="detail-total-amount">
                      {formatInr(detailData.total_amount)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
          <DialogFooter className="shrink-0 border-t pt-3">
            <Button
              variant="outline"
              onClick={closeDetail}
              data-testid="detail-close-btn"
            >
              Close
            </Button>
            <Button
              className="gradient-teal text-white"
              onClick={exportDetailCsv}
              disabled={!detailData || detailData.bookings.length === 0}
              data-testid="detail-export-btn"
            >
              <Download className="h-4 w-4 mr-1.5" />
              Export CSV
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
