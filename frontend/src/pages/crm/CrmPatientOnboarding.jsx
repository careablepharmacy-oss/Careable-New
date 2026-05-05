import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft, Save, User, MapPin, Heart, Phone, Shield,
  RefreshCw, CheckCircle2, AlertTriangle,
  Clock, Camera, Megaphone
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import DetectedDiseasesCard from "@/components/crm/DetectedDiseasesCard";
import MedicationForm from "@/components/MedicationForm";
import { Pill, Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  getOnboardingProfile,
  updateOnboardingProfile,
  getPatientSyncStatus,
  syncPatient,
  syncMedications,
  syncVitals,
  getPatient,
  addMedicine,
  updateMedicine,
  deleteMedicine
} from "@/lib/crmApi";

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand",
  "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
  "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
  "Uttar Pradesh", "Uttarakhand", "West Bengal", "Delhi", "Chandigarh"
];

export default function PatientOnboarding() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const [form, setForm] = useState({
    name: "", email: "", phone: "", picture: "", age: "", sex: "",
    address: "", city: "", state: "", country: "India", pincode: "",
    adherence_rate: 85,
    main_disease: "", consulting_doctor_name: "", clinic_hospital_details: "",
    last_doctor_visit_date: "", regular_lab_details: "", last_lab_visit_date: "",
    mobility_status: "", other_critical_info: "", marketing_consent: "",
    relative_name: "", relative_email: "", relative_whatsapp: "",
    medicine_order_link: "", medicine_invoice_link: "", medicine_invoice_amount: "",
    injection_order_link: "", injection_invoice_link: "", injection_invoice_amount: "",
    product_order_link: "", product_invoice_link: "", product_invoice_amount: "",
    priority: "normal", onboarding_completed: false
  });
  const [originalForm, setOriginalForm] = useState(null);
  const [diseases, setDiseases] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [showMedicineDialog, setShowMedicineDialog] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState(null);
  const [medicineFormLoading, setMedicineFormLoading] = useState(false);

  useEffect(() => {
    fetchProfile();
    fetchSyncStatus();
    fetchMedicines();
  }, [id]);

  const fetchMedicines = async () => {
    try {
      const res = await getPatient(id);
      setMedicines(res.data?.medicines || []);
    } catch (err) {
      // non-blocking
    }
  };

  const handleMedicineFormSubmit = async (data) => {
    setMedicineFormLoading(true);
    try {
      if (editingMedicine) {
        await updateMedicine(id, editingMedicine.id, data);
        toast.success("Medicine updated");
      } else {
        await addMedicine(id, data);
        toast.success("Medicine added");
      }
      setShowMedicineDialog(false);
      setEditingMedicine(null);
      fetchMedicines();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to save medicine");
    } finally {
      setMedicineFormLoading(false);
    }
  };

  const handleMedicineDelete = async (med) => {
    if (!window.confirm(`Remove ${med.name} from this patient's medicines?`)) return;
    try {
      await deleteMedicine(id, med.id);
      toast.success("Medicine removed");
      fetchMedicines();
    } catch (err) {
      toast.error("Failed to remove medicine");
    }
  };

  const fetchProfile = async () => {
    try {
      const res = await getOnboardingProfile(id);
      const d = res.data;
      const formData = {
        name: d.name || "",
        email: d.email || "",
        phone: d.phone || "",
        picture: d.picture || "",
        age: d.age != null ? String(d.age) : "",
        sex: d.sex || "",
        address: d.address || "",
        city: d.city || "",
        state: d.state || "",
        country: d.country || "India",
        pincode: d.pincode || "",
        adherence_rate: d.adherence_rate || 85,
        main_disease: d.main_disease || "",
        consulting_doctor_name: d.consulting_doctor_name || "",
        clinic_hospital_details: d.clinic_hospital_details || "",
        last_doctor_visit_date: d.last_doctor_visit_date || "",
        regular_lab_details: d.regular_lab_details || "",
        last_lab_visit_date: d.last_lab_visit_date || "",
        mobility_status: d.mobility_status || "",
        other_critical_info: d.other_critical_info || "",
        marketing_consent: d.marketing_consent || "",
        relative_name: d.relative_name || "",
        relative_email: d.relative_email || "",
        relative_whatsapp: d.relative_whatsapp || "",
        medicine_order_link: d.medicine_order_link || "",
        medicine_invoice_link: d.medicine_invoice_link || "",
        medicine_invoice_amount: d.medicine_invoice_amount != null ? String(d.medicine_invoice_amount) : "",
        injection_order_link: d.injection_order_link || "",
        injection_invoice_link: d.injection_invoice_link || "",
        injection_invoice_amount: d.injection_invoice_amount != null ? String(d.injection_invoice_amount) : "",
        product_order_link: d.product_order_link || "",
        product_invoice_link: d.product_invoice_link || "",
        product_invoice_amount: d.product_invoice_amount != null ? String(d.product_invoice_amount) : "",
        priority: d.priority || "normal",
        onboarding_completed: !!d.onboarding_completed
      };
      setForm(formData);
      setOriginalForm(formData);
      setDiseases(d.diseases || []);
    } catch {
      toast.error("Failed to load onboarding profile");
    } finally {
      setLoading(false);
    }
  };

  const fetchSyncStatus = async () => {
    try {
      const res = await getPatientSyncStatus(id);
      setSyncStatus(res.data);
    } catch {
      // Not synced patient — ok
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Patient name is required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        age: form.age ? parseInt(form.age) : null,
        medicine_invoice_amount: form.medicine_invoice_amount ? parseFloat(form.medicine_invoice_amount) : null,
        injection_invoice_amount: form.injection_invoice_amount ? parseFloat(form.injection_invoice_amount) : null,
        product_invoice_amount: form.product_invoice_amount ? parseFloat(form.product_invoice_amount) : null,
        adherence_rate: parseFloat(form.adherence_rate) || 85,
      };
      await updateOnboardingProfile(id, payload);
      toast.success("Profile updated successfully!");
      setOriginalForm(form);
    } catch {
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async (type) => {
    if (!syncStatus?.encare_user_id) {
      toast.error("This patient is not linked to an Careable 360+ account");
      return;
    }
    setSyncing(true);
    try {
      const encareId = syncStatus.encare_user_id;
      if (type === "patient") {
        await syncPatient(encareId);
        toast.success("Patient data synced from Careable 360+!");
        fetchProfile();
      } else if (type === "medications") {
        await syncMedications(encareId);
        toast.success("Medications synced from Careable 360+!");
      } else if (type === "vitals") {
        await syncVitals(encareId);
        toast.success("Vitals synced from Careable 360+!");
      }
      fetchSyncStatus();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const hasChanges = originalForm && JSON.stringify(form) !== JSON.stringify(originalForm);

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  // Highlights unfilled (empty) fields with an amber border. Caller skips link/URL fields.
  const emptyCls = (val) =>
    (val === "" || val === null || val === undefined)
      ? "border-amber-400 bg-amber-50/40 focus-visible:border-amber-500 focus-visible:ring-amber-200"
      : "";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="onboarding-loading">
        <RefreshCw className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto" data-testid="onboarding-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to={`/crm/patients/${id}`}>
            <Button variant="ghost" data-testid="back-to-patient-btn">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Patient
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Onboarding Profile
            </h1>
            <p className="text-sm text-slate-500">
              Edit patient profile — fields mirror Careable 360+ MEDI REMINDER
            </p>
          </div>
        </div>
        <div className="flex gap-3 items-center">
          {/* Mark onboarding complete — hides this patient from the Dashboard Onboarding section */}
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none"
                 title="Tick this to remove the patient from the Dashboard Onboarding card">
            <input
              type="checkbox"
              checked={!!form.onboarding_completed}
              onChange={(e) => update("onboarding_completed", e.target.checked)}
              className="h-4 w-4 accent-teal-600 cursor-pointer"
              data-testid="onboarding-completed-checkbox"
            />
            <span>Onboarding complete</span>
          </label>
          {hasChanges && (
            <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">
              Unsaved changes
            </Badge>
          )}
          <Button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="gradient-teal text-white"
            data-testid="save-profile-btn"
          >
            {saving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Profile
          </Button>
        </div>
      </div>

      {/* Sync Status Bar */}
      {syncStatus?.encare_user_id && (
        <Card className="border-[#2BA89F]/30 bg-gradient-to-r from-[#E6F4F2] to-[#F0F7E5]" data-testid="sync-status-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-teal-100 text-teal-600">
                  <RefreshCw className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-teal-800">
                    Linked to Careable 360+: <span className="font-bold">{syncStatus.encare_user_id}</span>
                  </p>
                  {syncStatus.last_synced_at && (
                    <p className="text-xs text-teal-600 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Last synced: {new Date(syncStatus.last_synced_at).toLocaleString('en-IN')}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-teal-300 text-teal-700 hover:bg-teal-100"
                  onClick={() => handleSync("patient")}
                  disabled={syncing}
                  data-testid="sync-patient-btn"
                >
                  {syncing ? <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                  Sync Profile
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-teal-300 text-teal-700 hover:bg-teal-100"
                  onClick={() => handleSync("medications")}
                  disabled={syncing}
                  data-testid="sync-medications-btn"
                >
                  Sync Meds
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-teal-300 text-teal-700 hover:bg-teal-100"
                  onClick={() => handleSync("vitals")}
                  disabled={syncing}
                  data-testid="sync-vitals-btn"
                >
                  Sync Vitals
                </Button>
              </div>
            </div>
            {/* Recent sync logs */}
            {syncStatus.sync_logs?.length > 0 && (
              <div className="mt-3 pt-3 border-t border-teal-200/50">
                <p className="text-xs text-teal-600 font-medium mb-1">Recent Sync Activity</p>
                <div className="space-y-1">
                  {syncStatus.sync_logs.slice(0, 3).map((log, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-teal-700">
                      <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                      <span>{log.details}</span>
                      <span className="text-teal-500 ml-auto whitespace-nowrap">
                        {new Date(log.synced_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Picture & Priority */}
      <Card data-testid="profile-picture-section">
        <CardContent className="p-6">
          <div className="flex items-center gap-6">
            <div className="relative">
              {form.picture ? (
                <img src={form.picture} alt={form.name} className="w-24 h-24 rounded-full object-cover border-4 border-teal-100" />
              ) : (
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-teal-100 to-emerald-100 flex items-center justify-center text-3xl font-bold text-teal-600">
                  {form.name ? form.name.charAt(0) : "?"}
                </div>
              )}
              <div className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-white shadow-sm border border-slate-200">
                <Camera className="h-3.5 w-3.5 text-slate-400" />
              </div>
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <Label className="text-xs text-slate-500">Profile Picture URL</Label>
                <Input
                  value={form.picture}
                  onChange={(e) => update("picture", e.target.value)}
                  placeholder="https://..."
                  className={`mt-1 ${emptyCls(form.picture)}`}
                  data-testid="profile-picture-input"
                />
              </div>
              <div className="flex items-center gap-4">
                <div>
                  <Label className="text-xs text-slate-500">Priority</Label>
                  <Select value={form.priority} onValueChange={(v) => update("priority", v)}>
                    <SelectTrigger className="w-36 mt-1" data-testid="priority-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.priority === "high" && (
                  <Badge variant="destructive" className="mt-5">
                    <AlertTriangle className="h-3 w-3 mr-1" /> High Priority
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Personal Information */}
      <Card data-testid="personal-info-section">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4 text-teal-500" />
            Personal Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Full Name <span className="text-red-400">*</span></Label>
              <Input
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                className={emptyCls(form.name)}
                placeholder="Patient full name"
                data-testid="name-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Phone</Label>
              <Input
                value={form.phone}
                readOnly
                tabIndex={-1}
                className="bg-slate-50 text-slate-600 cursor-not-allowed"
                title="Phone is read-only — managed by the patient via the mobile app"
                placeholder="+91 XXXXX XXXXX"
                data-testid="phone-input"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Email</Label>
              <Input
                type="email"
                value={form.email}
                readOnly
                tabIndex={-1}
                className="bg-slate-50 text-slate-600 cursor-not-allowed"
                title="Email is read-only — managed by the patient via the mobile app"
                placeholder="patient@email.com"
                data-testid="email-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Age</Label>
              <Input
                type="number"
                value={form.age}
                onChange={(e) => update("age", e.target.value)}
                className={emptyCls(form.age)}
                placeholder="45"
                min="0"
                max="120"
                data-testid="age-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Sex</Label>
              <Select value={form.sex} onValueChange={(v) => update("sex", v)}>
                <SelectTrigger data-testid="sex-select" className={emptyCls(form.sex)}><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Address */}
      <Card data-testid="address-section">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4 text-teal-500" />
            Address
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500">Street Address</Label>
            <Input
              value={form.address}
              onChange={(e) => update("address", e.target.value)}
                className={emptyCls(form.address)}
              placeholder="House/Flat No., Street, Locality"
              data-testid="address-input"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">City</Label>
              <Input
                value={form.city}
                onChange={(e) => update("city", e.target.value)}
                className={emptyCls(form.city)}
                placeholder="City"
                data-testid="city-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">State</Label>
              <Select value={form.state} onValueChange={(v) => update("state", v)}>
                <SelectTrigger data-testid="state-select" className={emptyCls(form.state)}><SelectValue placeholder="Select State" /></SelectTrigger>
                <SelectContent>
                  {INDIAN_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Pincode</Label>
              <Input
                value={form.pincode}
                onChange={(e) => update("pincode", e.target.value)}
                className={emptyCls(form.pincode)}
                placeholder="6-digit pincode"
                maxLength={6}
                data-testid="pincode-input"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500">Country</Label>
            <Input
              value={form.country}
              onChange={(e) => update("country", e.target.value)}
                className={emptyCls(form.country)}
              placeholder="India"
              data-testid="country-input"
            />
          </div>
        </CardContent>
      </Card>

      {/* Medicines — same Add/Edit flow as Patient Profile → Medicine tab */}
      <Card data-testid="onboarding-medicines-section">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Pill className="h-4 w-4 text-teal-500" />
              Medicines
              {medicines.length > 0 && (
                <Badge variant="secondary" className="ml-1">{medicines.length}</Badge>
              )}
            </CardTitle>
            <Button
              size="sm"
              className="gradient-teal text-white"
              onClick={() => { setEditingMedicine(null); setShowMedicineDialog(true); }}
              data-testid="onboarding-add-medicine-btn"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Medicine
            </Button>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Capture the patient's current medicines. Same form as the Patient Profile → Medicine tab.
          </p>
        </CardHeader>
        <CardContent>
          {medicines.length === 0 ? (
            <p className="text-center text-slate-500 text-sm py-4">No medicines added yet</p>
          ) : (
            <div className="space-y-2" data-testid="onboarding-medicines-list">
              {medicines.map((med, i) => (
                <div
                  key={med.id || i}
                  className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50"
                  data-testid={`onboarding-medicine-row-${i}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800 truncate">{med.name}</p>
                    <p className="text-xs text-slate-500">
                      {med.form || "Tablet"}
                      {med.dosage ? ` · ${med.dosage}` : ""}
                      {med.tablets_per_strip ? ` · ${med.tablets_per_strip}/strip` : ""}
                      {med.cost_per_unit ? ` · ₹${med.cost_per_unit}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setEditingMedicine(med); setShowMedicineDialog(true); }}
                      data-testid={`onboarding-edit-medicine-${i}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleMedicineDelete(med)}
                      data-testid={`onboarding-delete-medicine-${i}`}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Medicine Dialog — uses the SAME MedicationForm as the Patient Profile */}
      <Dialog
        open={showMedicineDialog}
        onOpenChange={(open) => {
          setShowMedicineDialog(open);
          if (!open) setEditingMedicine(null);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingMedicine ? "Edit Medicine" : "Add Medicine"}</DialogTitle>
          </DialogHeader>
          <MedicationForm
            initialData={editingMedicine || {}}
            mode={editingMedicine ? "edit" : "add"}
            isPrescriptionManager={true}
            onSubmit={handleMedicineFormSubmit}
            onCancel={() => { setShowMedicineDialog(false); setEditingMedicine(null); }}
            isLoading={medicineFormLoading}
          />
        </DialogContent>
      </Dialog>

      {/* AI Detected Diseases (placed just above Medical Information per user request) */}
      <DetectedDiseasesCard
        patientId={id}
        compact={true}
        selectedDiseases={diseases}
        onSaved={fetchProfile}
      />

      {/* Medical Information */}
      <Card data-testid="medical-info-section">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Heart className="h-4 w-4 text-teal-500" />
            Medical Information
          </CardTitle>
          <p className="text-xs text-slate-500">
            Checklist for healthcare executive to collect key patient medical details
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Main Disease */}
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500">Main Disease / Primary Condition</Label>
            <Input
              value={form.main_disease}
              onChange={(e) => update("main_disease", e.target.value)}
                className={emptyCls(form.main_disease)}
              placeholder="e.g. Type 2 Diabetes, Hypertension"
              data-testid="main-disease-input"
            />
          </div>

          {/* Consulting Doctor */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Name of Consulting Doctor</Label>
              <Input
                value={form.consulting_doctor_name}
                onChange={(e) => update("consulting_doctor_name", e.target.value)}
                className={emptyCls(form.consulting_doctor_name)}
                placeholder="Dr. Full Name"
                data-testid="consulting-doctor-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Clinic / Hospital Details</Label>
              <Input
                value={form.clinic_hospital_details}
                onChange={(e) => update("clinic_hospital_details", e.target.value)}
                className={emptyCls(form.clinic_hospital_details)}
                placeholder="Hospital name, branch or address"
                data-testid="clinic-hospital-input"
              />
            </div>
          </div>

          {/* Last Doctor Visit */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Date of Last Doctor Visit</Label>
              <Input
                type="date"
                value={form.last_doctor_visit_date}
                onChange={(e) => update("last_doctor_visit_date", e.target.value)}
                className={emptyCls(form.last_doctor_visit_date)}
                data-testid="last-doctor-visit-input"
              />
            </div>
          </div>

          {/* Lab Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Regular Lab Details</Label>
              <Input
                value={form.regular_lab_details}
                onChange={(e) => update("regular_lab_details", e.target.value)}
                className={emptyCls(form.regular_lab_details)}
                placeholder="Lab name, branch or address"
                data-testid="regular-lab-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Date of Last Lab Visit</Label>
              <Input
                type="date"
                value={form.last_lab_visit_date}
                onChange={(e) => update("last_lab_visit_date", e.target.value)}
                className={emptyCls(form.last_lab_visit_date)}
                data-testid="last-lab-visit-input"
              />
            </div>
          </div>

          {/* Mobility Status */}
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500">Patient's Mobility Status</Label>
            <Select value={form.mobility_status || "not_set"} onValueChange={(v) => update("mobility_status", v === "not_set" ? "" : v)}>
              <SelectTrigger data-testid="mobility-status-select" className={emptyCls(form.mobility_status)}><SelectValue placeholder="Select mobility status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="not_set">-- Select --</SelectItem>
                <SelectItem value="Independent">Independent</SelectItem>
                <SelectItem value="Needs Assistance">Needs Assistance</SelectItem>
                <SelectItem value="Uses Walking Aid">Uses Walking Aid</SelectItem>
                <SelectItem value="Wheelchair">Wheelchair</SelectItem>
                <SelectItem value="Bedridden">Bedridden</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Other Critical Info */}
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500">Any Other Critical Information</Label>
            <textarea
              value={form.other_critical_info}
              onChange={(e) => update("other_critical_info", e.target.value)}
                className={emptyCls(form.other_critical_info)}
              placeholder="Allergies, special conditions, surgery history, dietary restrictions..."
              rows={3}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              data-testid="other-critical-info-input"
            />
          </div>
        </CardContent>
      </Card>

      {/* Marketing Consent */}
      <Card data-testid="marketing-consent-section">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-teal-500" />
            Marketing Consent
          </CardTitle>
          <p className="text-xs text-slate-500">
            Patient's preference for receiving product suggestions and promotional outreach
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { value: "open", label: "Open", desc: "Happy to receive product suggestions, promotional calls, WhatsApp messages, etc.", color: "border-green-200 bg-green-50", activeColor: "border-green-500 bg-green-50 ring-2 ring-green-200", dot: "bg-green-500" },
              { value: "moderate", label: "Moderate", desc: "Okay with limited suggestions (e.g., medicine refills only, no promotional calls)", color: "border-amber-200 bg-amber-50", activeColor: "border-amber-500 bg-amber-50 ring-2 ring-amber-200", dot: "bg-amber-500" },
              { value: "do_not_contact", label: "Do Not Contact", desc: "Does not want any marketing outreach or product suggestions", color: "border-red-200 bg-red-50", activeColor: "border-red-500 bg-red-50 ring-2 ring-red-200", dot: "bg-red-500" },
            ].map((opt) => (
              <label
                key={opt.value}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${form.marketing_consent === opt.value ? opt.activeColor : opt.color + ' hover:shadow-sm'}`}
                data-testid={`consent-option-${opt.value}`}
              >
                <input
                  type="radio"
                  name="marketing_consent"
                  value={opt.value}
                  checked={form.marketing_consent === opt.value}
                  onChange={(e) => update("marketing_consent", e.target.value)}
                className={emptyCls(form.marketing_consent)}
                  className="sr-only"
                />
                <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${form.marketing_consent === opt.value ? 'border-current' : 'border-slate-300'}`}>
                  {form.marketing_consent === opt.value && <div className={`w-2 h-2 rounded-full ${opt.dot}`} />}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800">{opt.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Caregiver / Emergency Contact */}
      <Card data-testid="caregiver-section">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-teal-500" />
            Emergency Contact / Caregiver
          </CardTitle>
          <p className="text-xs text-slate-500">
            Aligned with Careable 360+'s relative fields
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Relative Name</Label>
              <Input
                value={form.relative_name}
                onChange={(e) => update("relative_name", e.target.value)}
                className={emptyCls(form.relative_name)}
                placeholder="Caregiver/relative name"
                data-testid="relative-name-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Relative WhatsApp</Label>
              <Input
                value={form.relative_whatsapp}
                onChange={(e) => update("relative_whatsapp", e.target.value)}
                className={emptyCls(form.relative_whatsapp)}
                placeholder="+91 XXXXX XXXXX"
                data-testid="relative-whatsapp-input"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500">Relative Email</Label>
            <Input
              type="email"
              value={form.relative_email}
              onChange={(e) => update("relative_email", e.target.value)}
                className={emptyCls(form.relative_email)}
              placeholder="relative@email.com"
              data-testid="relative-email-input"
            />
          </div>
        </CardContent>
      </Card>

      {/* Invoice & Order Links moved to Patient Profile → "Invoices & Orders" tab */}

      {/* Spacer so content doesn't hide behind sticky bar */}
      <div className="h-20" />

      {/* Bottom Save Bar */}
      <div className="sticky bottom-0 -mx-4 lg:-mx-6 px-4 lg:px-6 py-3 bg-white/95 backdrop-blur-sm border-t border-slate-200 flex justify-end gap-3 z-30" data-testid="bottom-save-bar">
        <Link to={`/crm/patients/${id}`}>
          <Button variant="outline" data-testid="cancel-btn">Cancel</Button>
        </Link>
        <Button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="gradient-teal text-white shadow-lg"
          data-testid="save-profile-bottom-btn"
        >
          {saving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save Profile
        </Button>
      </div>
    </div>
  );
}
