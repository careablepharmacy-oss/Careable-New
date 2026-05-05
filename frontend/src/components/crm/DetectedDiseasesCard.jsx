import { useEffect, useState, useCallback, useMemo } from "react";
import { Sparkles, Stethoscope, RefreshCw, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { getDetectedDiseases, selectDetectedDiseases } from "@/lib/crmApi";

/**
 * AI-Detected Diseases card — shows Gemini-detected diseases with CHECKBOXES.
 * The HA selects one or more diseases; on Save the selection becomes
 * patient.diseases + main_disease, and Lab Test / Product suggestions auto-update.
 *
 * Props:
 *   patientId: string
 *   compact: bool
 *   selectedDiseases: string[]   — current patient.diseases (controls initial checks)
 *   onSaved: () => void          — fired after save so parent can refresh patient + suggestions
 */
export default function DetectedDiseasesCard({
  patientId,
  compact = false,  // eslint-disable-line no-unused-vars
  selectedDiseases = [],
  onSaved,
}) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ diseases: [], medical_equipment: [], personal_care: [] });
  const [selected, setSelected] = useState(new Set());
  const [saving, setSaving] = useState(false);
  // Collapsed by default to keep the patient profile uncluttered
  const [expanded, setExpanded] = useState(false);

  const initialSelectionKey = useMemo(
    () => (selectedDiseases || []).map(d => (d || "").toLowerCase()).sort().join("|"),
    [selectedDiseases]
  );

  const fetchData = useCallback(async (warm = true) => {
    try {
      setLoading(true);
      const res = await getDetectedDiseases(patientId, warm);
      setData(res.data);
    } catch (err) {
      console.error("Failed to load detected diseases", err);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    if (patientId) fetchData(true);
  }, [patientId, fetchData]);

  // Initialise / re-sync local checkbox state from the patient's saved diseases
  useEffect(() => {
    setSelected(new Set((selectedDiseases || []).map(d => (d || "").toLowerCase())));
  }, [initialSelectionKey]);  // eslint-disable-line

  const toggle = (name) => {
    const key = (name || "").toLowerCase();
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Preserve original casing from the AI list when saving
      const chosen = data.diseases
        .filter(d => selected.has((d.name || "").toLowerCase()))
        .map(d => d.name);
      await selectDetectedDiseases(patientId, chosen);
      toast.success(
        chosen.length
          ? `Saved ${chosen.length} disease${chosen.length === 1 ? "" : "s"} to patient profile`
          : "Cleared diseases on patient profile"
      );
      if (onSaved) onSaved();
    } catch (err) {
      toast.error("Failed to save selection");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="border-purple-200 bg-gradient-to-r from-purple-50/50 to-white" data-testid="detected-diseases-card">
        <CardContent className="py-6 text-center text-slate-500 text-sm">
          <Sparkles className="h-5 w-5 mx-auto mb-2 text-purple-400 animate-pulse" />
          Analyzing medications with AI…
        </CardContent>
      </Card>
    );
  }

  if (!data.diseases?.length) {
    return (
      <Card className="border-slate-200" data-testid="detected-diseases-card">
        <CardContent className="py-5 text-center text-slate-500 text-sm">
          <Sparkles className="h-5 w-5 mx-auto mb-2 text-slate-300" />
          No diseases detected yet.
          <p className="text-xs text-slate-400 mt-1">Add medicines to the patient — AI analyzes them automatically.</p>
          <Button variant="ghost" size="sm" className="mt-2 text-purple-600" onClick={() => fetchData(true)} data-testid="detected-diseases-rescan-btn">
            <RefreshCw className="h-3 w-3 mr-1" /> Re-scan
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Track if local selection differs from saved
  const savedKey = (selectedDiseases || []).map(d => (d || "").toLowerCase()).sort().join("|");
  const currentKey = Array.from(selected).sort().join("|");
  const dirty = savedKey !== currentKey;

  return (
    <Card className="border-purple-200 bg-gradient-to-r from-purple-50/50 to-white" data-testid="detected-diseases-card">
      <CardHeader
        className="pb-3 cursor-pointer select-none hover:bg-purple-50/40 transition-colors rounded-t-lg"
        onClick={() => setExpanded(v => !v)}
        role="button"
        aria-expanded={expanded}
        data-testid="detected-diseases-toggle"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            <CardTitle className="text-base font-semibold">AI-Detected Diseases</CardTitle>
            <Badge className="bg-purple-600 text-white" data-testid="detected-diseases-count">
              {data.diseases.length}
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => { e.stopPropagation(); fetchData(true); }}
              title="Re-scan"
              data-testid="detected-diseases-rescan-btn"
            >
              <RefreshCw className="h-4 w-4 text-slate-500" />
            </Button>
            {expanded ? (
              <ChevronUp className="h-4 w-4 text-slate-500" data-testid="detected-diseases-chevron-up" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-500" data-testid="detected-diseases-chevron-down" />
            )}
          </div>
        </div>
        {expanded && (
          <p className="text-xs text-slate-500 mt-1">
            Tick the diseases this patient actually has. Selected ones are saved to <span className="font-medium">Main Disease / Primary Condition</span> and drive Lab Test &amp; Product suggestions.
          </p>
        )}
      </CardHeader>
      {expanded && (
      <CardContent className="space-y-3" data-testid="detected-diseases-content">
        <div className="flex flex-col gap-2" data-testid="detected-diseases-list">
          {data.diseases.map((d, i) => {
            const key = (d.name || "").toLowerCase();
            const checked = selected.has(key);
            return (
              <label
                key={d.name}
                className={`flex items-start gap-2.5 px-3 py-2 rounded-lg bg-white border ${
                  checked ? "border-purple-400 ring-1 ring-purple-200" : "border-slate-200"
                } shadow-sm cursor-pointer hover:border-purple-300 transition`}
                data-testid={`detected-disease-${i}`}
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => toggle(d.name)}
                  className="mt-0.5"
                  data-testid={`detected-disease-checkbox-${i}`}
                />
                <Stethoscope className="h-4 w-4 text-purple-600 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-slate-800">{d.name}</span>
                  {d.from_medicines?.length > 0 && (
                    <span className="text-[11px] text-slate-500 block">
                      from {d.from_medicines.join(", ")}
                    </span>
                  )}
                </div>
              </label>
            );
          })}
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] text-slate-500">
            {selected.size} selected
            {dirty && <span className="text-amber-600 ml-2">• unsaved changes</span>}
          </span>
          <Button
            size="sm"
            disabled={saving || !dirty}
            onClick={handleSave}
            className="gradient-coral text-white"
            data-testid="detected-diseases-save-btn"
          >
            <CheckCircle2 className="h-4 w-4 mr-1" />
            {saving ? "Saving…" : "Apply Selection"}
          </Button>
        </div>
      </CardContent>
      )}
    </Card>
  );
}
