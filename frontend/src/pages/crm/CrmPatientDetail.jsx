import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  User,
  Pill,
  Activity,
  FlaskConical,
  ShoppingBag,
  MessageSquare,
  Calendar,
  Plus,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Clock,
  Heart,
  ExternalLink,
  IndianRupee,
  Pencil,
  Trash2,
  X,
  Stethoscope,
  Building2,
  CheckCircle2,
  ShieldAlert,
  Ban,
  ClipboardList,
  Receipt,
  FileText,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import MedicationForm from "@/components/MedicationForm";
import DetectedDiseasesCard from "@/components/crm/DetectedDiseasesCard";
import PurchaseLinksPanel from "@/components/PurchaseLinksPanel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip as ShadTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";
import {
  getPatient,
  addVital,
  addInteraction,
  addMedicine,
  updateMedicine,
  deleteMedicine,
  getProductSuggestions,
  getLabTestSuggestions,
  bookLabTest,
  createDoctorAppointment,
  getDoctorAppointments,
  updateAppointmentStatus,
  getLaboratories,
  recordRevenueConversion,
  getPatientMtdRevenue,
  getPatientMonthlyInvoiceAmount,
  getPatientPendingTasks,
  togglePatientTask,
  getPatientInvoicesAndOrders
} from "@/lib/crmApi";
import { useNavigate } from "react-router-dom";

export default function PatientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [productSuggestions, setProductSuggestions] = useState([]);
  const [labSuggestions, setLabSuggestions] = useState([]);
  const [pendingTasks, setPendingTasks] = useState([]);
  const [taskSaving, setTaskSaving] = useState({});
  // Collapsible sections — collapsed by default to keep the page uncluttered
  const [showMedicalInfo, setShowMedicalInfo] = useState(false);
  const [showPendingTasks, setShowPendingTasks] = useState(false);
  const [showVitalDialog, setShowVitalDialog] = useState(false);
  const [showInteractionDialog, setShowInteractionDialog] = useState(false);
  const [showLabDialog, setShowLabDialog] = useState(false);
  const [newVital, setNewVital] = useState({ type: "bp", value: "", systolic: "", diastolic: "", meal_context: "Fasting", notes: "" });
  const [newInteraction, setNewInteraction] = useState({ type: "call", purpose: "", notes: "", outcome: "positive", follow_up_date: "", follow_up_time: "09:00" });
  const [selectedLabTest, setSelectedLabTest] = useState(null);
  // --- New Lab Test Booking multi-step flow state ---
  // step: null (closed) | 'preference' | 'featured_select' | 'booking'
  const [labFlowStep, setLabFlowStep] = useState(null);
  const [labSource, setLabSource] = useState(null); // 'featured' | 'preferred_lab'
  const [featuredSelections, setFeaturedSelections] = useState({}); // { [name]: true }
  const [customFeaturedTests, setCustomFeaturedTests] = useState([]); // [{name, price, selected}]
  const [customFeaturedInput, setCustomFeaturedInput] = useState({ name: "", price: "" });
  const [preferredTests, setPreferredTests] = useState([{ name: "", price: "" }]);
  const [catalogLaboratories, setCatalogLaboratories] = useState([]);
  // Discounted amount (free-text) for Select Featured Lab Tests — used to compute savings & converted revenue
  const [labDiscountedAmount, setLabDiscountedAmount] = useState("");
  const [labBookingForm, setLabBookingForm] = useState({
    lab_name: "",
    custom_lab_name: "",
    use_custom_lab: false,
    date: "",
    time: "10:00",
    notes: ""
  });
  const [showMedicineDialog, setShowMedicineDialog] = useState(false);
  const [medicationFormLoading, setMedicationFormLoading] = useState(false);
  const [mtdRevenue, setMtdRevenue] = useState({ total: 0, count: 0, by_category: { invoice_followup: 0, lab_test: 0 }, month: "", previous: { month: "", total: 0 }, trend: { direction: "flat", percent: 0 } });
  const [doctorAppointments, setDoctorAppointments] = useState([]);
  const [showApptDialog, setShowApptDialog] = useState(false);
  const [apptForm, setApptForm] = useState({
    type: "doctor", title: "Doctor Consultation", doctor: "", hospital: "",
    date: "", time: "10:00", location: "", notes: ""
  });
  const [editingMedicine, setEditingMedicine] = useState(null);
  // Invoices & Orders tab state
  const [invoicesData, setInvoicesData] = useState({ invoices: [], invoice_count: 0, order_links: null });
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [invoiceItems, setInvoiceItems] = useState([{ name: "", price: "" }]);
  const [invoiceDiscountedPrice, setInvoiceDiscountedPrice] = useState("");
  const [showInvoiceConfirm, setShowInvoiceConfirm] = useState(false);
  // Medicine Invoice (Refill → inline invoice section) flow
  const [medicineInvoiceItems, setMedicineInvoiceItems] = useState([]); // [{ name, strips, price, medIndex }]
  const [medicineInvoiceActualPrice, setMedicineInvoiceActualPrice] = useState("");
  const [showMedicineInvoiceConfirm, setShowMedicineInvoiceConfirm] = useState(false);
  // System-computed Monthly Medicine Invoice Amount (sum of qty × cost across all
  // include_in_invoice medications). Mirrors PM Invoice Creator logic.
  const [monthlyInvoiceAmount, setMonthlyInvoiceAmount] = useState(0);
  const [showGenerateMonthlyConfirm, setShowGenerateMonthlyConfirm] = useState(false);
  const [generatingMonthlyInvoice, setGeneratingMonthlyInvoice] = useState(false);
  const [medForm, setMedForm] = useState({
    name: "", dosage: "", form: "Tablet", color: "#FF6B6B", instructions: "",
    frequency: "daily", timings: [{ time: "08:00", amount: "1" }],
    tablet_stock_count: "", cost_per_unit: "", include_in_invoice: true
  });

  const MEDICINE_FORMS = ["Tablet", "Capsule", "Injection", "Syrup", "Inhaler", "Cream", "Drops"];
  const MEDICINE_COLORS = ["#FF6B6B", "#4ECDC4", "#9B59B6", "#3498DB", "#E74C3C", "#1ABC9C", "#F39C12", "#2ECC71"];

  const fetchPatient = async () => {
    try {
      const res = await getPatient(id);
      setPatient(res.data);

      const [productsRes, labsRes, apptsRes, labsCatalogRes, tasksRes, monthlyRes] = await Promise.all([
        getProductSuggestions(id),
        getLabTestSuggestions(id),
        getDoctorAppointments(id),
        getLaboratories(),
        getPatientPendingTasks(id).catch(() => ({ data: [] })),
        getPatientMonthlyInvoiceAmount(id).catch(() => ({ data: { amount: 0 } }))
      ]);
      setProductSuggestions(productsRes.data);
      setLabSuggestions(labsRes.data);
      setDoctorAppointments(apptsRes.data);
      setCatalogLaboratories(labsCatalogRes.data || []);
      setPendingTasks(tasksRes.data || []);
      setMonthlyInvoiceAmount(parseFloat(monthlyRes.data?.amount) || 0);
    } catch (error) {
      toast.error("Failed to fetch patient details");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTask = async (task) => {
    const key = task.id;
    setTaskSaving(s => ({ ...s, [key]: true }));
    try {
      await togglePatientTask(id, {
        task_id: task.id,
        task_type: task.task_type,
        done: true,
      });
      setPendingTasks(prev => prev.filter(t => t.id !== task.id));
      toast.success("Task marked done");
    } catch (err) {
      toast.error("Failed to mark task done: " + (err?.response?.data?.detail || err.message));
    } finally {
      setTaskSaving(s => ({ ...s, [key]: false }));
    }
  };

  useEffect(() => {
    fetchPatient();
    fetchMtdRevenue();
    fetchInvoicesAndOrders();
  }, [id]);

  const fetchInvoicesAndOrders = async () => {
    try {
      setInvoicesLoading(true);
      const res = await getPatientInvoicesAndOrders(id);
      setInvoicesData(res.data || { invoices: [], order_links: null });
    } catch (err) {
      // non-blocking
    } finally {
      setInvoicesLoading(false);
    }
  };

  const fetchMtdRevenue = async () => {
    try {
      const res = await getPatientMtdRevenue(id);
      setMtdRevenue(res.data || { total: 0, count: 0, by_category: { invoice_followup: 0, lab_test: 0 }, previous: { month: "", total: 0 }, trend: { direction: "flat", percent: 0 } });
    } catch {
      // silent — non-blocking
    }
  };

  const fetchMonthlyInvoiceAmount = async () => {
    try {
      const res = await getPatientMonthlyInvoiceAmount(id);
      setMonthlyInvoiceAmount(parseFloat(res.data?.amount) || 0);
    } catch {
      // silent — non-blocking
    }
  };

  const handleAddVital = async () => {
    try {
      const vitalData = {
        type: newVital.type,
        notes: newVital.notes || undefined
      };
      if (newVital.type === "bp") {
        vitalData.systolic = parseInt(newVital.systolic);
        vitalData.diastolic = parseInt(newVital.diastolic);
      } else if (newVital.type === "sugar") {
        vitalData.value = parseInt(newVital.value);
        vitalData.meal_context = newVital.meal_context;
      } else {
        vitalData.value = parseFloat(newVital.value);
      }
      await addVital(id, vitalData);
      toast.success("Vital recorded successfully!");
      setShowVitalDialog(false);
      setNewVital({ type: "bp", value: "", systolic: "", diastolic: "", meal_context: "Fasting", notes: "" });
      fetchPatient();
    } catch (error) {
      toast.error("Failed to record vital");
    }
  };

  const handleAddInteraction = async () => {
    if (!newInteraction.follow_up_date) {
      toast.error("Follow-up date is required");
      return;
    }
    if (!newInteraction.follow_up_time) {
      toast.error("Follow-up time is required");
      return;
    }
    const followUpDt = new Date(`${newInteraction.follow_up_date}T${newInteraction.follow_up_time}`);
    if (followUpDt <= new Date()) {
      toast.error("Follow-up date and time must be in the future");
      return;
    }
    try {
      await addInteraction(id, {
        ...newInteraction,
        purpose: newInteraction.purposes.join(", ")
      });
      toast.success("Interaction logged successfully!");
      setShowInteractionDialog(false);
      setNewInteraction({ type: "call", purposes: [], notes: "", outcome: "positive", follow_up_date: "", follow_up_time: "09:00" });
      fetchPatient();
    } catch (error) {
      toast.error("Failed to log interaction");
    }
  };

  const handleBookAppointment = async () => {
    if (!apptForm.date || !apptForm.time) {
      toast.error("Date and time are required");
      return;
    }
    try {
      await createDoctorAppointment(id, apptForm);
      toast.success("Appointment booked successfully!");
      setShowApptDialog(false);
      setApptForm({ type: "doctor", title: "Doctor Consultation", doctor: "", hospital: "", date: "", time: "10:00", location: "", notes: "" });
      fetchPatient();
    } catch (error) {
      toast.error("Failed to book appointment");
    }
  };

  const handleAppointmentStatus = async (appointmentId, status) => {
    try {
      await updateAppointmentStatus(id, appointmentId, status);
      toast.success(`Appointment marked as ${status}`);
      fetchPatient();
    } catch (error) {
      toast.error("Failed to update appointment status");
    }
  };


  // Add a medicine row to the inline Medicine Invoice section (triggered by "Refill" button)
  const openRefillInvoice = (med, index) => {
    const unitCost = parseFloat(med?.cost_per_unit);
    const prefilledPrice = Number.isFinite(unitCost) && unitCost > 0
      ? String(+unitCost.toFixed(2))
      : "";
    setMedicineInvoiceItems(prev => {
      // Prevent adding the exact same medicine twice — focus instead
      if (prev.some(it => it.medIndex === index)) {
        toast.info(`${med.name} is already in the invoice`);
        return prev;
      }
      return [...prev, { name: med.name || "", strips: "", price: prefilledPrice, medIndex: index }];
    });
    // Scroll into view after state update
    setTimeout(() => {
      const el = document.querySelector('[data-testid="medicine-invoice-section"]');
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const addMedicineInvoiceRow = () => {
    setMedicineInvoiceItems(prev => [...prev, { name: "", strips: "", price: "", medIndex: null }]);
  };

  const updateMedicineInvoiceItem = (idx, field, value) => {
    setMedicineInvoiceItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  };

  const removeMedicineInvoiceItem = (idx) => {
    setMedicineInvoiceItems(prev => prev.filter((_, i) => i !== idx));
  };

  const resetMedicineInvoice = () => {
    setMedicineInvoiceItems([]);
    setMedicineInvoiceActualPrice("");
  };

  const resetMedForm = () => {
    setMedForm({
      name: "", dosage: "", form: "Tablet", color: "#FF6B6B", instructions: "",
      frequency: "daily", timings: [{ time: "08:00", amount: "1" }],
      tablet_stock_count: "", cost_per_unit: "", include_in_invoice: true
    });
    setEditingMedicine(null);
  };

  const openAddMedicine = () => {
    resetMedForm();
    setShowMedicineDialog(true);
  };

  const openEditMedicine = (med) => {
    const timings = med.schedule?.dosage_timings?.length > 0
      ? med.schedule.dosage_timings
      : [{ time: "08:00", amount: "1" }];
    setMedForm({
      name: med.name || "",
      dosage: med.dosage || "",
      form: med.form || "Tablet",
      color: med.color || "#FF6B6B",
      instructions: med.instructions || "",
      frequency: med.schedule?.frequency || "daily",
      timings,
      tablet_stock_count: med.tablet_stock_count != null ? String(med.tablet_stock_count) : "",
      cost_per_unit: med.cost_per_unit != null ? String(med.cost_per_unit) : "",
      include_in_invoice: med.include_in_invoice !== false
    });
    setEditingMedicine(med);
    setShowMedicineDialog(true);
  };

  const handleSaveMedicine = async () => {
    if (!medForm.name.trim()) {
      toast.error("Medicine name is required");
      return;
    }
    try {
      const payload = {
        name: medForm.name,
        dosage: medForm.dosage,
        form: medForm.form,
        color: medForm.color,
        instructions: medForm.instructions || null,
        schedule: {
          frequency: medForm.frequency,
          times: [],
          dosage_timings: medForm.timings.filter(t => t.time),
          start_date: new Date().toISOString().split('T')[0],
          end_date: null,
          weekly_days: []
        },
        tablet_stock_count: medForm.tablet_stock_count ? parseInt(medForm.tablet_stock_count) : null,
        cost_per_unit: medForm.cost_per_unit ? parseFloat(medForm.cost_per_unit) : null,
        include_in_invoice: medForm.include_in_invoice
      };

      if (editingMedicine) {
        await updateMedicine(id, editingMedicine.id, payload);
        toast.success("Medicine updated successfully!");
      } else {
        await addMedicine(id, payload);
        toast.success("Medicine added successfully!");
      }
      setShowMedicineDialog(false);
      resetMedForm();
      fetchPatient();
    } catch (error) {
      toast.error(editingMedicine ? "Failed to update medicine" : "Failed to add medicine");
    }
  };

  // Handler wired to the reusable MedicationForm component (same as PM Dashboard uses).
  // Routes through the CRM `/api/crm/patients/{id}/medicines` endpoint so disease-intel
  // warming + adherence regeneration still trigger. Same db.medications collection.
  const handleMedicationFormSubmit = async (medicationData) => {
    setMedicationFormLoading(true);
    try {
      if (editingMedicine) {
        await updateMedicine(id, editingMedicine.id, medicationData);
        toast.success("Medicine updated successfully!");
      } else {
        await addMedicine(id, medicationData);
        toast.success("Medicine added successfully!");
      }
      setShowMedicineDialog(false);
      setEditingMedicine(null);
      fetchPatient();
    } catch (error) {
      toast.error(editingMedicine
        ? `Failed to update medicine: ${error?.response?.data?.detail || error.message}`
        : `Failed to add medicine: ${error?.response?.data?.detail || error.message}`);
    } finally {
      setMedicationFormLoading(false);
    }
  };

  const handleDeleteMedicine = async (med) => {
    if (!window.confirm(`Remove ${med.name} from this patient's medicines?`)) return;
    try {
      await deleteMedicine(id, med.id);
      toast.success("Medicine removed");
      fetchPatient();
    } catch (error) {
      toast.error("Failed to remove medicine");
    }
  };

  const addTimingRow = () => {
    setMedForm(prev => ({ ...prev, timings: [...prev.timings, { time: "", amount: "1" }] }));
  };

  const removeTimingRow = (idx) => {
    setMedForm(prev => ({ ...prev, timings: prev.timings.filter((_, i) => i !== idx) }));
  };

  const updateTiming = (idx, field, value) => {
    setMedForm(prev => ({
      ...prev,
      timings: prev.timings.map((t, i) => i === idx ? { ...t, [field]: value } : t)
    }));
  };

  const handleBookLabTest = async () => {
    if (!selectedLabTest) return;
    try {
      const bookingDate = new Date();
      bookingDate.setDate(bookingDate.getDate() + 3);
      await bookLabTest(id, {
        test_name: selectedLabTest.name,
        booked_date: bookingDate.toISOString(),
        price: selectedLabTest.price
      });
      toast.success(`${selectedLabTest.name} booked successfully!`);
      setShowLabDialog(false);
      setSelectedLabTest(null);
      fetchPatient();
    } catch (error) {
      toast.error("Failed to book lab test");
    }
  };

  // --- New multi-step Lab Test Booking Flow handlers ---
  const resetLabFlow = () => {
    setLabFlowStep(null);
    setLabSource(null);
    setFeaturedSelections({});
    setCustomFeaturedTests([]);
    setCustomFeaturedInput({ name: "", price: "" });
    setPreferredTests([{ name: "", price: "" }]);
    setLabBookingForm({ lab_name: "", custom_lab_name: "", use_custom_lab: false, date: "", time: "10:00", notes: "" });
    setLabDiscountedAmount("");
  };

  const openLabFlow = () => {
    resetLabFlow();
    setLabFlowStep("preference");
  };

  const chooseLabSource = (source) => {
    setLabSource(source);
    if (source === "featured") {
      setLabFlowStep("featured_select");
    } else {
      // Preferred lab: jump straight to booking details. Start with one empty test row.
      setPreferredTests([{ name: "", price: "" }]);
      setLabFlowStep("booking");
    }
  };

  const toggleFeaturedSelection = (name) => {
    setFeaturedSelections(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const toggleCustomFeaturedSelection = (idx) => {
    setCustomFeaturedTests(prev => prev.map((t, i) => i === idx ? { ...t, selected: !t.selected } : t));
  };

  // Select / Deselect ALL featured tests (both suggested and custom-added)
  const toggleSelectAllFeatured = () => {
    const suggestedNames = labSuggestions.map(t => t.name);
    const allSuggestedChecked = suggestedNames.length > 0 && suggestedNames.every(n => !!featuredSelections[n]);
    const allCustomChecked = customFeaturedTests.length === 0 || customFeaturedTests.every(t => t.selected);
    const allChecked = allSuggestedChecked && allCustomChecked && (suggestedNames.length > 0 || customFeaturedTests.length > 0);
    const next = !allChecked;
    setFeaturedSelections(() => {
      const obj = {};
      suggestedNames.forEach(n => { obj[n] = next; });
      return obj;
    });
    setCustomFeaturedTests(prev => prev.map(t => ({ ...t, selected: next })));
  };

  const removeCustomFeaturedTest = (idx) => {
    setCustomFeaturedTests(prev => prev.filter((_, i) => i !== idx));
  };

  const addCustomFeaturedTest = () => {
    const name = customFeaturedInput.name.trim();
    const price = parseFloat(customFeaturedInput.price);
    if (!name) {
      toast.error("Please enter a test name");
      return;
    }
    if (Number.isNaN(price) || price < 0) {
      toast.error("Please enter a valid price");
      return;
    }
    setCustomFeaturedTests(prev => [...prev, { name, price, selected: true }]);
    setCustomFeaturedInput({ name: "", price: "" });
  };

  const getSelectedFeaturedTests = () => {
    const chosenFeatured = labSuggestions
      .filter(t => featuredSelections[t.name])
      .map(t => ({ name: t.name, price: Number(t.price) || 0 }));
    const chosenCustom = customFeaturedTests
      .filter(t => t.selected)
      .map(t => ({ name: t.name, price: Number(t.price) || 0 }));
    return [...chosenFeatured, ...chosenCustom];
  };

  const proceedFromFeaturedToBooking = () => {
    const selected = getSelectedFeaturedTests();
    if (selected.length === 0) {
      toast.error("Please select at least one test");
      return;
    }
    if (!labBookingForm.lab_name) {
      toast.error("Please select a laboratory");
      return;
    }
    setLabFlowStep("booking");
  };

  const updatePreferredTest = (idx, field, value) => {
    setPreferredTests(prev => prev.map((t, i) => i === idx ? { ...t, [field]: value } : t));
  };

  const addPreferredTestRow = () => {
    setPreferredTests(prev => [...prev, { name: "", price: "" }]);
  };

  const removePreferredTestRow = (idx) => {
    setPreferredTests(prev => prev.length === 1 ? prev : prev.filter((_, i) => i !== idx));
  };

  // Resolve the final list of tests regardless of flow path
  const getFinalTestsForBooking = () => {
    if (labSource === "featured") {
      return getSelectedFeaturedTests();
    }
    return preferredTests
      .filter(t => t.name.trim())
      .map(t => ({ name: t.name.trim(), price: parseFloat(t.price) || 0 }));
  };

  const labBookingTotal = getFinalTestsForBooking().reduce((s, t) => s + (t.price || 0), 0);

  // Featured Lab Tests — total of selected tests, actual (discounted) amount, savings
  const labFeaturedTotal = getSelectedFeaturedTests().reduce((s, t) => s + (t.price || 0), 0);
  const labFeaturedActualValue = parseFloat(labDiscountedAmount);
  const hasLabFeaturedDiscount =
    labDiscountedAmount !== "" &&
    !Number.isNaN(labFeaturedActualValue) &&
    labFeaturedActualValue >= 0 &&
    labFeaturedActualValue <= labFeaturedTotal;
  const effectiveLabFeaturedAmount = hasLabFeaturedDiscount
    ? labFeaturedActualValue
    : labFeaturedTotal;
  const labFeaturedSavings = Math.max(0, labFeaturedTotal - effectiveLabFeaturedAmount);

  // Past labs used for this patient (dropdown source)
  const pastLabNames = Array.from(
    new Set(
      (patient?.lab_tests || [])
        .map(lt => lt.lab_name)
        .filter(Boolean)
    )
  );

  const handleSubmitLabBooking = async () => {
    const tests = getFinalTestsForBooking();
    if (tests.length === 0) {
      toast.error("Please add at least one test");
      return;
    }
    const finalLabName = labBookingForm.use_custom_lab
      ? labBookingForm.custom_lab_name.trim()
      : labBookingForm.lab_name.trim();
    if (!finalLabName) {
      toast.error("Please select or enter a lab name");
      return;
    }
    if (!labBookingForm.date) {
      toast.error("Please choose a date");
      return;
    }
    if (!labBookingForm.time) {
      toast.error("Please choose a time");
      return;
    }
    try {
      const bookedDateIso = new Date(`${labBookingForm.date}T${labBookingForm.time}`).toISOString();
      // One booking per selected test, all sharing same lab / date / time / notes
      await Promise.all(
        tests.map(t =>
          bookLabTest(id, {
            test_name: t.name,
            price: t.price || 0,
            booked_date: bookedDateIso,
            scheduled_time: labBookingForm.time,
            lab_name: finalLabName,
            notes: labBookingForm.notes || null,
            source: labSource
          })
        )
      );
      toast.success(`${tests.length} lab test${tests.length > 1 ? 's' : ''} booked at ${finalLabName}`);
      // Backend `book_lab_test` already records each booking under `lab_test`
      // category. Do NOT also record under `invoice_followup` — that double-counts
      // the same booking across two revenue categories.
      resetLabFlow();
      fetchPatient();
      fetchMtdRevenue();
    } catch (error) {
      toast.error("Failed to book lab tests");
    }
  };

  // ---- Custom Invoice (E-commerce) helpers ----
  const addInvoiceItemRow = () => {
    setInvoiceItems(prev => [...prev, { name: "", price: "" }]);
  };

  const updateInvoiceItem = (idx, field, value) => {
    setInvoiceItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  };

  const removeInvoiceItem = (idx) => {
    setInvoiceItems(prev => prev.length === 1 ? prev : prev.filter((_, i) => i !== idx));
  };

  const resetInvoice = () => {
    setInvoiceItems([{ name: "", price: "" }]);
    setInvoiceDiscountedPrice("");
  };

  const invoiceTotal = invoiceItems.reduce(
    (sum, it) => sum + (parseFloat(it.price) || 0),
    0
  );

  const invoiceDiscountedValue = parseFloat(invoiceDiscountedPrice);
  const hasDiscount =
    invoiceDiscountedPrice !== "" &&
    !Number.isNaN(invoiceDiscountedValue) &&
    invoiceDiscountedValue >= 0 &&
    invoiceDiscountedValue <= invoiceTotal;
  const effectiveDiscountedPrice = hasDiscount ? invoiceDiscountedValue : invoiceTotal;
  const invoiceSavings = Math.max(0, invoiceTotal - effectiveDiscountedPrice);

  const hasValidInvoiceItem = invoiceItems.some(
    it => it.name.trim() !== "" && parseFloat(it.price) > 0
  );

  const handleOpenInvoiceConfirm = () => {
    if (!hasValidInvoiceItem) {
      toast.error("Please add at least one product with a valid name and price");
      return;
    }
    setShowInvoiceConfirm(true);
  };

  const handleConfirmInvoice = async () => {
    try {
      const validItems = invoiceItems.filter(
        it => it.name.trim() && parseFloat(it.price) > 0
      );
      await recordRevenueConversion(id, {
        category: "invoice_followup",
        source: "product_invoice",
        amount: effectiveDiscountedPrice,
        description: `Product invoice: ${validItems.map(it => it.name.trim()).join(", ")}`
      });
      toast.success(`Customer confirmed — ₹${effectiveDiscountedPrice.toLocaleString("en-IN")} added to converted revenue`);
      setShowInvoiceConfirm(false);

      // Unified Invoice Creator hand-off — carry customer + items + savings
      const prefill = {
        source: "crm_product_invoice",
        user_id: id,
        customer: {
          name: patient?.name || "",
          email: patient?.email || "",
          phone: patient?.phone || "",
          address: getFullAddress(),
        },
        items: validItems.map(it => ({
          name: it.name.trim(),
          quantity: 1,
          unit_price: parseFloat(it.price) || 0,
        })),
        global_discount_type: "fixed",
        global_discount_value: invoiceSavings,
      };
      resetInvoice();
      fetchMtdRevenue();
      navigate("/invoice-manager/invoices/create", { state: { prefill } });
    } catch (error) {
      toast.error("Failed to record the invoice conversion");
    }
  };

  // ---- Medicine Invoice calculations & confirm ----
  const medicineInvoiceTotal = medicineInvoiceItems.reduce((sum, it) => {
    const strips = parseFloat(it.strips) || 0;
    const price = parseFloat(it.price) || 0;
    return sum + strips * price;
  }, 0);

  const medicineInvoiceActualValue = parseFloat(medicineInvoiceActualPrice);
  const hasMedicineDiscount =
    medicineInvoiceActualPrice !== "" &&
    !Number.isNaN(medicineInvoiceActualValue) &&
    medicineInvoiceActualValue >= 0 &&
    medicineInvoiceActualValue <= medicineInvoiceTotal;
  const effectiveMedicineActualPrice = hasMedicineDiscount
    ? medicineInvoiceActualValue
    : medicineInvoiceTotal;
  const medicineInvoiceSavings = Math.max(0, medicineInvoiceTotal - effectiveMedicineActualPrice);

  const hasValidMedicineInvoiceItem = medicineInvoiceItems.some(
    it => it.name.trim() !== "" && parseFloat(it.strips) > 0 && parseFloat(it.price) > 0
  );

  const handleOpenMedicineInvoiceConfirm = () => {
    if (!hasValidMedicineInvoiceItem) {
      toast.error("Please add at least one medicine with a valid name, strips and price");
      return;
    }
    setShowMedicineInvoiceConfirm(true);
  };

  const handleConfirmMedicineInvoice = async () => {
    try {
      const validItems = medicineInvoiceItems.filter(
        it => it.name.trim() && parseFloat(it.strips) > 0 && parseFloat(it.price) > 0
      );
      await recordRevenueConversion(id, {
        category: "invoice_followup",
        source: "medicine_invoice",
        amount: effectiveMedicineActualPrice,
        description: `Medicine invoice: ${validItems
          .map(it => `${it.name.trim()} × ${it.strips}`)
          .join(", ")}`
      });
      toast.success(`Customer confirmed — ₹${effectiveMedicineActualPrice.toLocaleString("en-IN")} added to converted revenue`);
      setShowMedicineInvoiceConfirm(false);

      // Unified Invoice Creator hand-off — carry customer + items + savings
      const prefill = {
        source: "crm_medicine_invoice",
        user_id: id,
        customer: {
          name: patient?.name || "",
          email: patient?.email || "",
          phone: patient?.phone || "",
          address: getFullAddress(),
        },
        items: validItems.map(it => ({
          name: it.name.trim(),
          quantity: parseFloat(it.strips) || 1,
          unit_price: parseFloat(it.price) || 0,
        })),
        global_discount_type: "fixed",
        global_discount_value: medicineInvoiceSavings,
      };
      resetMedicineInvoice();
      fetchPatient();
      fetchMtdRevenue();
      navigate("/invoice-manager/invoices/create", { state: { prefill } });
    } catch (error) {
      toast.error("Failed to record the medicine invoice conversion");
    }
  };

  const handleGenerateMonthlyInvoice = () => {
    // Unified invoice flow — mirrors PM's "Generate Invoice" button.
    // Shows a confirm dialog so HA can review the auto-computed monthly
    // amount that will be added to Converted Revenue before navigating
    // to the shared Invoice Creator.
    if (!id) {
      toast.error("Patient ID missing");
      return;
    }
    if (!monthlyInvoiceAmount || monthlyInvoiceAmount <= 0) {
      toast.error("No medicines available to generate a monthly invoice. Add medicines first.");
      return;
    }
    setShowGenerateMonthlyConfirm(true);
  };

  const handleConfirmGenerateMonthlyInvoice = async () => {
    if (generatingMonthlyInvoice) return;
    setGeneratingMonthlyInvoice(true);
    try {
      await recordRevenueConversion(id, {
        category: "invoice_followup",
        source: "monthly_medicine_invoice",
        amount: monthlyInvoiceAmount,
        description: `Monthly medicine invoice generated for ${patient?.name || "patient"}`,
      });
      toast.success(`₹${monthlyInvoiceAmount.toLocaleString("en-IN")} added to Converted Revenue`);
      setShowGenerateMonthlyConfirm(false);
      fetchMtdRevenue();
      navigate(`/invoice-manager/invoices/create?userId=${id}`);
    } catch (err) {
      toast.error("Failed to record monthly invoice revenue");
    } finally {
      setGeneratingMonthlyInvoice(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Patient not found</p>
        <Link to="/crm/patients">
          <Button className="mt-4">Back to Patients</Button>
        </Link>
      </div>
    );
  }

  // Prepare vitals chart data from split collections
  const bpData = (patient.blood_pressure || [])
    .slice()
    .reverse()
    .slice(-10)
    .map(v => ({
      date: v.date,
      systolic: v.systolic,
      diastolic: v.diastolic
    }));

  const sugarData = (patient.blood_glucose || [])
    .slice()
    .reverse()
    .slice(-10)
    .map(v => ({
      date: v.date,
      value: v.value,
      context: v.meal_context
    }));

  const getStockInfo = (med) => {
    const stockStatus = med.stock_status || {};
    const form = (med.form || "Tablet").toLowerCase();
    if (form === "injection") {
      return {
        stock: stockStatus.iu_remaining || med.injection_iu_remaining || 0,
        unit: "IU remaining",
        daysLeft: stockStatus.days_left || 999,
        isLow: stockStatus.is_low || false,
        displayStock: `${stockStatus.stock || med.injection_stock_count || 0} vials`
      };
    }
    return {
      stock: med.tablet_stock_count || 0,
      unit: form === "capsule" ? "capsules" : "tablets",
      daysLeft: stockStatus.days_left || 999,
      isLow: stockStatus.is_low || false,
      displayStock: `${med.tablet_stock_count || 0} ${form === "capsule" ? "capsules" : "tablets"}`
    };
  };

  const getTimingDisplay = (med) => {
    const timings = med.schedule?.dosage_timings || [];
    if (timings.length === 0) {
      const times = med.schedule?.times || [];
      return times.length > 0 ? times.join(", ") : "As needed";
    }
    return timings.map(t => t.time).join(", ");
  };

  const getFullAddress = () => {
    const parts = [patient.address, patient.city, patient.state, patient.pincode].filter(Boolean);
    return parts.join(", ");
  };

  // Calculate total invoice
  const totalInvoice = (patient.medicine_invoice_amount || 0) + (patient.injection_invoice_amount || 0);

  return (
    <div className="space-y-6" data-testid="patient-detail-page">
      {/* Back Button */}
      <Link to="/crm/patients">
        <Button variant="ghost" className="mb-4" data-testid="back-to-patients-btn">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Patients
        </Button>
      </Link>

      {/* Patient Header */}
      <Card className="overflow-hidden" data-testid="patient-header-card">
        <div className="gradient-teal p-6">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            {patient.picture ? (
              <img
                src={patient.picture}
                alt={patient.name}
                className="w-20 h-20 rounded-full border-4 border-white/30 object-cover"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center text-white text-3xl font-bold">
                {patient.name.charAt(0)}
              </div>
            )}
            <div className="flex-1 text-white">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold">{patient.name}</h1>
                <TooltipProvider>
                  <ShadTooltip>
                    <TooltipTrigger asChild>
                      <Badge className={`priority-${patient.priority} border-0 cursor-help`} data-testid="patient-detail-priority-badge">
                        {patient.priority} priority
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs text-xs">
                      <p data-testid="patient-detail-priority-reason">{patient.priority_reason || "No reason available"}</p>
                    </TooltipContent>
                  </ShadTooltip>
                </TooltipProvider>
                {patient.marketing_consent && (
                  <Badge
                    className={`border-0 ${
                      patient.marketing_consent === 'open' ? 'bg-green-500/20 text-green-100' :
                      patient.marketing_consent === 'moderate' ? 'bg-amber-500/20 text-amber-100' :
                      'bg-red-500/20 text-red-100'
                    }`}
                    data-testid="consent-badge"
                  >
                    {patient.marketing_consent === 'open' ? 'Marketing: Open' :
                     patient.marketing_consent === 'moderate' ? 'Marketing: Moderate' :
                     'Do Not Contact'}
                  </Badge>
                )}
                <TooltipProvider delayDuration={150}>
                  <ShadTooltip>
                    <TooltipTrigger asChild>
                      <Badge
                        className="border-0 bg-white/15 text-white backdrop-blur-sm hover:bg-white/25 cursor-default flex items-center gap-1.5"
                        data-testid="mtd-revenue-chip"
                      >
                        <IndianRupee className="h-3 w-3" />
                        <span className="font-semibold tabular-nums">
                          {mtdRevenue.total.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </span>
                        <span className="text-white/70 text-[10px] uppercase tracking-wider">MTD</span>
                        {(() => {
                          const dir = mtdRevenue.trend?.direction;
                          const pct = mtdRevenue.trend?.percent || 0;
                          if (dir === "up") {
                            return (
                              <span className="flex items-center gap-0.5 text-green-200 text-[11px] tabular-nums pl-1 border-l border-white/20" data-testid="mtd-trend-up">
                                <TrendingUp className="h-3 w-3" />
                                {Math.abs(pct)}%
                              </span>
                            );
                          }
                          if (dir === "down") {
                            return (
                              <span className="flex items-center gap-0.5 text-rose-200 text-[11px] tabular-nums pl-1 border-l border-white/20" data-testid="mtd-trend-down">
                                <TrendingDown className="h-3 w-3" />
                                {Math.abs(pct)}%
                              </span>
                            );
                          }
                          if (dir === "new") {
                            return (
                              <span className="text-green-200 text-[10px] uppercase tracking-wider pl-1 border-l border-white/20" data-testid="mtd-trend-new">
                                New
                              </span>
                            );
                          }
                          return null;
                        })()}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs" data-testid="mtd-revenue-tooltip">
                      <div className="space-y-1">
                        <p className="font-semibold text-xs">
                          Month-to-Date Converted Revenue
                          {mtdRevenue.month ? <span className="text-slate-500"> • {mtdRevenue.month}</span> : null}
                        </p>
                        <div className="flex items-center justify-between gap-4 text-xs">
                          <span className="text-slate-500">Invoice Follow-up</span>
                          <span className="tabular-nums">₹{mtdRevenue.by_category?.invoice_followup?.toLocaleString("en-IN") || 0}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4 text-xs">
                          <span className="text-slate-500">Lab Tests</span>
                          <span className="tabular-nums">₹{mtdRevenue.by_category?.lab_test?.toLocaleString("en-IN") || 0}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4 text-xs border-t pt-1 mt-1">
                          <span className="font-medium">Total</span>
                          <span className="font-semibold tabular-nums">₹{mtdRevenue.total.toLocaleString("en-IN")}</span>
                        </div>
                        {mtdRevenue.previous?.month ? (
                          <div className="flex items-center justify-between gap-4 text-xs text-slate-500">
                            <span>Last month ({mtdRevenue.previous.month})</span>
                            <span className="tabular-nums">₹{(mtdRevenue.previous.total || 0).toLocaleString("en-IN")}</span>
                          </div>
                        ) : null}
                        {(() => {
                          const dir = mtdRevenue.trend?.direction;
                          const pct = mtdRevenue.trend?.percent || 0;
                          if (dir === "up") {
                            return <p className="text-[11px] text-green-600 font-medium">▲ {Math.abs(pct)}% vs last month</p>;
                          }
                          if (dir === "down") {
                            return <p className="text-[11px] text-rose-600 font-medium">▼ {Math.abs(pct)}% vs last month</p>;
                          }
                          if (dir === "new") {
                            return <p className="text-[11px] text-green-600 font-medium">New conversion this month</p>;
                          }
                          return null;
                        })()}
                        <p className="text-[10px] text-slate-400 pt-1">
                          {mtdRevenue.count} conversion{mtdRevenue.count === 1 ? '' : 's'} recorded this month
                        </p>
                      </div>
                    </TooltipContent>
                  </ShadTooltip>
                </TooltipProvider>
              </div>
              <p className="text-white/80 mt-1">
                {patient.age ? `${patient.age} years` : ''}{patient.sex ? ` • ${patient.sex}` : ''}
                {patient.city ? ` • ${patient.city}` : ''}
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {patient.diseases?.map((disease, i) => (
                  <Badge key={i} variant="outline" className="border-white/30 text-white bg-white/10">
                    {disease}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                className="bg-white text-teal-600 hover:bg-white/90"
                onClick={() => navigate(`/crm/patients/${id}/onboarding`)}
                data-testid="edit-profile-btn"
              >
                <Pencil className="h-4 w-4 mr-2" />
                Edit Profile
              </Button>
              <Button
                className="bg-white text-teal-600 hover:bg-white/90"
                onClick={() => window.location.href = `tel:${patient.phone}`}
                data-testid="call-patient-btn"
              >
                <Phone className="h-4 w-4 mr-2" />
                Call Patient
              </Button>
              <Dialog open={showInteractionDialog} onOpenChange={setShowInteractionDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="border-white/30 text-white hover:bg-white/20" data-testid="log-interaction-btn">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Log Interaction
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[85vh] flex flex-col" data-testid="interaction-dialog">
                  <DialogHeader className="shrink-0 border-b pb-3">
                    <DialogTitle>Log Interaction</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4 overflow-y-auto flex-1 min-h-0 pr-1">
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select
                        value={newInteraction.type}
                        onValueChange={(v) => setNewInteraction({ ...newInteraction, type: v })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="call">Phone Call</SelectItem>
                          <SelectItem value="message">Message</SelectItem>
                          <SelectItem value="visit">Visit</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Purpose <span className="text-xs text-slate-400 font-normal">(select all that apply)</span></Label>
                      <div className="grid grid-cols-2 gap-2 max-h-[180px] overflow-y-auto p-2 border rounded-md bg-slate-50" data-testid="interaction-purpose-select">
                        {[
                          "Onboarding Call",
                          "Medicine Refill Reminder", "Health Checkup Follow-up",
                          "Lab Test Reminder", "Doctor Visit Follow-up",
                          "Product Suggestion", "Vitals Collection",
                          "Payment / Invoice", "General Wellness Check",
                          "Complaint Resolution", "Other"
                        ].map((opt) => (
                          <label key={opt} className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-xs transition-colors ${(newInteraction.purposes || []).includes(opt) ? 'bg-teal-50 text-teal-800' : 'hover:bg-slate-100 text-slate-600'}`}>
                            <input
                              type="checkbox"
                              checked={(newInteraction.purposes || []).includes(opt)}
                              onChange={(e) => {
                                const current = newInteraction.purposes || [];
                                const updated = e.target.checked
                                  ? [...current, opt]
                                  : current.filter(p => p !== opt);
                                setNewInteraction({ ...newInteraction, purposes: updated });
                              }}
                              className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 h-3.5 w-3.5"
                            />
                            {opt}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Notes</Label>
                      <Textarea
                        value={newInteraction.notes}
                        onChange={(e) => setNewInteraction({ ...newInteraction, notes: e.target.value })}
                        placeholder="Describe the conversation..."
                        data-testid="interaction-notes-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Outcome</Label>
                      <Select
                        value={newInteraction.outcome}
                        onValueChange={(v) => setNewInteraction({ ...newInteraction, outcome: v })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="positive">Positive</SelectItem>
                          <SelectItem value="neutral">Neutral</SelectItem>
                          <SelectItem value="negative">Negative</SelectItem>
                          <SelectItem value="no_answer">No Answer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Follow-up Date <span className="text-red-500">*</span></Label>
                      <Input
                        type="date"
                        value={newInteraction.follow_up_date}
                        onChange={(e) => setNewInteraction({ ...newInteraction, follow_up_date: e.target.value })}
                        min={new Date().toISOString().split("T")[0]}
                        data-testid="interaction-followup-date"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Follow-up Time <span className="text-red-500">*</span></Label>
                      <Input
                        type="time"
                        value={newInteraction.follow_up_time}
                        onChange={(e) => setNewInteraction({ ...newInteraction, follow_up_time: e.target.value })}
                        data-testid="interaction-followup-time"
                        required
                      />
                    </div>
                  </div>
                  <DialogFooter className="shrink-0 border-t pt-3">
                    <Button variant="outline" onClick={() => setShowInteractionDialog(false)}>Cancel</Button>
                    <Button onClick={handleAddInteraction} className="gradient-teal text-white" data-testid="save-interaction-btn">
                      Save Interaction
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        {/* Contact Info */}
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            {patient.phone && (
              <div className="flex items-center gap-2 text-slate-600">
                <Phone className="h-4 w-4" />
                <span>{patient.phone}</span>
              </div>
            )}
            {patient.email && (
              <div className="flex items-center gap-2 text-slate-600">
                <Mail className="h-4 w-4" />
                <span>{patient.email}</span>
              </div>
            )}
            {getFullAddress() && (
              <div className="flex items-center gap-2 text-slate-600">
                <MapPin className="h-4 w-4" />
                <span className="truncate">{getFullAddress()}</span>
              </div>
            )}
          </div>

          {/* Caregivers */}
          {patient.caregivers?.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Caregivers</p>
              <div className="flex flex-wrap gap-4">
                {patient.caregivers.map((cg, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-slate-400" />
                    <span className="text-slate-700">{cg.name}</span>
                    <span className="text-slate-400">({cg.relationship})</span>
                    {cg.phone && <a href={`tel:${cg.phone}`} className="text-teal-600 hover:underline">{cg.phone}</a>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Invoice Summary */}
          {totalInvoice > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="flex items-center gap-2 text-sm">
                <IndianRupee className="h-4 w-4 text-green-500" />
                <span className="text-slate-500">Monthly Invoice:</span>
                <span className="font-semibold text-green-600">₹{totalInvoice.toLocaleString('en-IN')}</span>
                {patient.medicine_invoice_link && (
                  <a href={patient.medicine_invoice_link} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline flex items-center gap-1">
                    <ExternalLink className="h-3 w-3" /> View Invoice
                  </a>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Priority Reason Section */}
      {patient.priority_reason && (() => {
        const reasons = patient.priority_reason
          .split(";")
          .map(r => r.trim())
          .filter(Boolean);
        const isHigh = patient.priority === "high";
        const isLow = patient.priority === "low";
        const toneBg = isHigh
          ? "bg-red-50 border-red-200"
          : isLow
            ? "bg-slate-50 border-slate-200"
            : "bg-amber-50 border-amber-200";
        const toneIcon = isHigh
          ? "text-red-600"
          : isLow
            ? "text-slate-500"
            : "text-amber-600";
        const toneLabel = isHigh
          ? "text-red-700"
          : isLow
            ? "text-slate-600"
            : "text-amber-700";
        const chipBg = isHigh
          ? "bg-white border-red-200 text-red-700"
          : isLow
            ? "bg-white border-slate-200 text-slate-600"
            : "bg-white border-amber-200 text-amber-700";
        return (
          <Card className={`${toneBg} border`} data-testid="priority-reason-card">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className={`shrink-0 mt-0.5 ${toneIcon}`}>
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`text-xs font-semibold uppercase tracking-wider ${toneLabel}`}>
                      Reason for {patient.priority || "normal"} priority
                    </p>
                    <Badge className={`priority-${patient.priority} border-0 text-[10px]`}>
                      {patient.priority}
                    </Badge>
                  </div>
                  {reasons.length > 1 ? (
                    <div className="flex flex-wrap gap-1.5 mt-2" data-testid="priority-reason-list">
                      {reasons.map((r, i) => (
                        <span
                          key={i}
                          className={`text-xs px-2.5 py-1 rounded-full border ${chipBg} tabular-nums`}
                          data-testid={`priority-reason-item-${i}`}
                        >
                          {r}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-700 mt-1" data-testid="priority-reason-single">
                      {reasons[0]}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-3 rounded-xl bg-purple-50 text-purple-500">
              <Pill className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{patient.medicines?.length || 0}</p>
              <p className="text-xs text-slate-500">Medicines</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`p-3 rounded-xl ${patient.adherence_rate >= 70 ? 'bg-green-50 text-green-500' : 'bg-red-50 text-red-500'}`}>
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{patient.adherence_rate}%</p>
              <p className="text-xs text-slate-500">Adherence</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-3 rounded-xl bg-blue-50 text-blue-500">
              <FlaskConical className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{patient.lab_tests?.length || 0}</p>
              <p className="text-xs text-slate-500">Lab Tests</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-3 rounded-xl bg-orange-50 text-orange-500">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{patient.interactions?.length || 0}</p>
              <p className="text-xs text-slate-500">Interactions</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-3 rounded-xl bg-indigo-50 text-indigo-500">
              <Stethoscope className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{doctorAppointments.length}</p>
              <p className="text-xs text-slate-500">Appointments</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Medical Information Summary */}
      {(patient.main_disease || patient.consulting_doctor_name || patient.clinic_hospital_details || patient.last_doctor_visit_date || patient.regular_lab_details || patient.last_lab_visit_date || patient.mobility_status || patient.other_critical_info) && (
        <Card data-testid="medical-info-summary">
          <CardHeader
            className="pb-3 cursor-pointer select-none hover:bg-slate-50/60 transition-colors rounded-t-lg"
            onClick={() => setShowMedicalInfo(v => !v)}
            role="button"
            aria-expanded={showMedicalInfo}
            data-testid="medical-info-toggle"
          >
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Heart className="h-4 w-4 text-teal-500" />
                Medical Information
              </CardTitle>
              {showMedicalInfo ? (
                <ChevronUp className="h-4 w-4 text-slate-400" data-testid="medical-info-chevron-up" />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate-400" data-testid="medical-info-chevron-down" />
              )}
            </div>
          </CardHeader>
          {showMedicalInfo && (
          <CardContent className="space-y-4" data-testid="medical-info-content">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3 text-sm">
              {patient.main_disease && (
                <div>
                  <p className="text-xs text-slate-400">Main Disease</p>
                  <p className="text-slate-800 font-medium">{patient.main_disease}</p>
                </div>
              )}
              {patient.consulting_doctor_name && (
                <div>
                  <p className="text-xs text-slate-400">Consulting Doctor</p>
                  <p className="text-slate-800 font-medium">{patient.consulting_doctor_name}</p>
                </div>
              )}
              {patient.clinic_hospital_details && (
                <div>
                  <p className="text-xs text-slate-400">Clinic / Hospital</p>
                  <p className="text-slate-800 font-medium">{patient.clinic_hospital_details}</p>
                </div>
              )}
              {patient.regular_lab_details && (
                <div>
                  <p className="text-xs text-slate-400">Regular Lab</p>
                  <p className="text-slate-800 font-medium">{patient.regular_lab_details}</p>
                </div>
              )}
              {patient.mobility_status && (
                <div>
                  <p className="text-xs text-slate-400">Mobility Status</p>
                  <p className="text-slate-800 font-medium">{patient.mobility_status}</p>
                </div>
              )}
              {patient.other_critical_info && (
                <div className="md:col-span-2 lg:col-span-3">
                  <p className="text-xs text-slate-400">Other Critical Information</p>
                  <p className="text-slate-800">{patient.other_critical_info}</p>
                </div>
              )}
            </div>

            {/* Next Due Dates */}
            {(patient.next_doctor_visit_due || patient.next_lab_visit_due) && (
              <div className="pt-3 border-t border-slate-100">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Next Due Dates</p>
                <div className="flex flex-wrap gap-3">
                  {patient.next_doctor_visit_due && (() => {
                    const due = new Date(patient.next_doctor_visit_due);
                    const today = new Date(); today.setHours(0,0,0,0);
                    const isOverdue = due < today;
                    const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
                    return (
                      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${isOverdue ? 'border-red-200 bg-red-50' : 'border-blue-200 bg-blue-50'}`} data-testid="next-doctor-due">
                        <Stethoscope className={`h-4 w-4 ${isOverdue ? 'text-red-500' : 'text-blue-500'}`} />
                        <div>
                          <p className={`text-xs font-medium ${isOverdue ? 'text-red-700' : 'text-blue-700'}`}>
                            Doctor Visit {isOverdue ? 'Overdue' : 'Due'}
                          </p>
                          <p className={`text-xs ${isOverdue ? 'text-red-600' : 'text-blue-600'}`}>
                            {due.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                            {isOverdue
                              ? ` (${Math.abs(diffDays)} days overdue)`
                              : diffDays <= 7 ? ` (in ${diffDays} days)` : ''}
                          </p>
                        </div>
                      </div>
                    );
                  })()}
                  {patient.next_lab_visit_due && (() => {
                    const due = new Date(patient.next_lab_visit_due);
                    const today = new Date(); today.setHours(0,0,0,0);
                    const isOverdue = due < today;
                    const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
                    return (
                      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${isOverdue ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50'}`} data-testid="next-lab-due">
                        <FlaskConical className={`h-4 w-4 ${isOverdue ? 'text-red-500' : 'text-emerald-500'}`} />
                        <div>
                          <p className={`text-xs font-medium ${isOverdue ? 'text-red-700' : 'text-emerald-700'}`}>
                            Lab Visit {isOverdue ? 'Overdue' : 'Due'}
                          </p>
                          <p className={`text-xs ${isOverdue ? 'text-red-600' : 'text-emerald-600'}`}>
                            {due.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                            {isOverdue
                              ? ` (${Math.abs(diffDays)} days overdue)`
                              : diffDays <= 7 ? ` (in ${diffDays} days)` : ''}
                          </p>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </CardContent>
          )}
        </Card>
      )}

      {/* AI Detected Diseases (Gemini-powered, cached per medicine) */}
      <DetectedDiseasesCard
        patientId={id}
        selectedDiseases={patient.diseases || []}
        onSaved={fetchPatient}
      />

      {/* Pending Tasks Card (checkbox-able list of all actionable items for this patient) */}
      {pendingTasks.length > 0 && (
        <Card className="border-[#2BA89F]/30 bg-gradient-to-r from-[#E6F4F2] to-white" data-testid="pending-tasks-card">
          <CardHeader
            className="pb-3 cursor-pointer select-none hover:bg-white/40 transition-colors rounded-t-lg"
            onClick={() => setShowPendingTasks(v => !v)}
            role="button"
            aria-expanded={showPendingTasks}
            data-testid="pending-tasks-toggle"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-teal-600" />
                <CardTitle className="text-base font-semibold">Pending Tasks</CardTitle>
                <Badge className="bg-teal-600 text-white">{pendingTasks.length}</Badge>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-xs text-slate-500 hidden sm:block">Check off as you complete each task</p>
                {showPendingTasks ? (
                  <ChevronUp className="h-4 w-4 text-slate-500" data-testid="pending-tasks-chevron-up" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-slate-500" data-testid="pending-tasks-chevron-down" />
                )}
              </div>
            </div>
          </CardHeader>
          {showPendingTasks && (
          <CardContent data-testid="pending-tasks-content">
            <div className="space-y-2">
              {pendingTasks.map((task, i) => {
                const saving = !!taskSaving[task.id];
                const typeLabel = {
                  refill: "Refill",
                  lab_test: "Lab Test",
                  product: "Product",
                  adherence: "Adherence",
                  invoice: "Invoice",
                  follow_up: "Follow-up",
                  doctor_appointment: "Doctor Appt",
                  feedback_call: "Feedback",
                  no_contact: "Reconnect",
                  onboarding: "Onboarding",
                  opportunity: "Opportunity",
                }[task.task_type] || task.task_type;
                const priorityColor = task.priority === "high" ? "bg-red-100 text-red-700 border-red-200"
                  : task.priority === "medium" ? "bg-amber-100 text-amber-700 border-amber-200"
                  : "bg-slate-100 text-slate-700 border-slate-200";
                return (
                  <div
                    key={task.id}
                    className="flex items-start gap-3 p-3 rounded-lg border bg-white hover:shadow-sm transition"
                    data-testid={`pending-task-${i}`}
                  >
                    <input
                      type="checkbox"
                      checked={false}
                      onChange={() => handleToggleTask(task)}
                      disabled={saving}
                      className="mt-1 h-4 w-4 accent-teal-600 cursor-pointer"
                      data-testid={`pending-task-checkbox-${i}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 capitalize ${priorityColor}`}>
                          {typeLabel}
                        </Badge>
                        {task.follow_up_time && (
                          <span className="text-xs font-medium text-teal-700">
                            {task.follow_up_time}
                          </span>
                        )}
                        {task.revenue > 0 && (
                          <span className="text-xs text-emerald-700 font-medium">
                            ₹{Math.round(task.revenue).toLocaleString()}
                          </span>
                        )}
                      </div>
                      <p className={`text-sm text-slate-800 mt-1 ${saving ? "opacity-50 line-through" : ""}`}>
                        {task.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
          )}
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="medicines" className="space-y-4">
        <TabsList className="bg-slate-100 p-1">
          <TabsTrigger value="medicines" data-testid="medicines-tab">
            <Pill className="h-4 w-4 mr-2" />
            Medicines
          </TabsTrigger>
          <TabsTrigger value="vitals" data-testid="vitals-tab">
            <Activity className="h-4 w-4 mr-2" />
            Vitals
          </TabsTrigger>
          <TabsTrigger value="products" data-testid="products-tab" disabled={patient.marketing_consent === 'do_not_contact'}>
            <ShoppingBag className="h-4 w-4 mr-2" />
            Products
            {patient.marketing_consent === 'do_not_contact' && <Ban className="h-3 w-3 ml-1 text-red-400" />}
          </TabsTrigger>
          <TabsTrigger value="labs" data-testid="labs-tab">
            <FlaskConical className="h-4 w-4 mr-2" />
            Lab Tests
          </TabsTrigger>
          <TabsTrigger value="doctor-booking" data-testid="doctor-booking-tab">
            <Stethoscope className="h-4 w-4 mr-2" />
            Doctor Booking
          </TabsTrigger>
          <TabsTrigger value="invoices-orders" data-testid="invoices-orders-tab">
            <Receipt className="h-4 w-4 mr-2" />
            Invoices & Orders
            {invoicesData.invoice_count > 0 && (
              <Badge variant="secondary" className="ml-2 px-1.5 py-0 text-[10px]">
                {invoicesData.invoice_count}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="interactions" data-testid="interactions-tab">
            <MessageSquare className="h-4 w-4 mr-2" />
            Interactions
          </TabsTrigger>
        </TabsList>

        {/* Medicines Tab */}
        <TabsContent value="medicines">
          <div className="space-y-4" data-testid="medicines-content">
            <div className="flex justify-end">
              <Button className="gradient-teal text-white" onClick={openAddMedicine} data-testid="add-medicine-btn">
                <Plus className="h-4 w-4 mr-2" />
                Add Medicine
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-semibold">Current Medicines</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {patient.medicines?.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <Pill className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                    <p>No medicines recorded</p>
                    <p className="text-sm mt-1">Add a medicine to start tracking</p>
                  </div>
                ) : (
                  patient.medicines?.map((med, i) => {
                    const stockInfo = getStockInfo(med);
                    return (
                      <div
                        key={med.id || i}
                        className={`p-4 rounded-lg border ${stockInfo.isLow ? 'border-red-200 bg-red-50' : 'border-slate-100 bg-slate-50'}`}
                        data-testid={`medicine-item-${i}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: med.color || '#FF6B6B' }} />
                              <h4 className="font-medium text-slate-900">{med.name}</h4>
                              <Badge variant="outline" className="text-xs">{med.form || 'Tablet'}</Badge>
                              {stockInfo.isLow && (
                                <Badge variant="destructive" className="text-xs">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  Low Stock
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-slate-500 mt-1">
                              {med.dosage}{med.schedule?.frequency ? ` • ${med.schedule.frequency}` : ''}
                            </p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {getTimingDisplay(med)}
                              </span>
                              <span>Stock: {stockInfo.displayStock}</span>
                              <span className={stockInfo.isLow ? 'text-red-600 font-medium' : ''}>
                                ~{stockInfo.daysLeft === 999 ? '---' : stockInfo.daysLeft} days left
                              </span>
                              {med.medicine_invoice_amount && (
                                <span className="text-green-600 font-medium">
                                  ₹{med.medicine_invoice_amount.toLocaleString('en-IN')}
                                </span>
                              )}
                            </div>
                            {med.instructions && (
                              <p className="text-xs text-slate-400 mt-1 italic">{med.instructions}</p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            {med.medicine_order_link && (
                              <a href={med.medicine_order_link} target="_blank" rel="noopener noreferrer">
                                <Button size="sm" variant="outline" className="text-xs">
                                  <ExternalLink className="h-3 w-3 mr-1" /> Order
                                </Button>
                              </a>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEditMedicine(med)}
                              data-testid={`edit-medicine-${i}`}
                            >
                              <Pencil className="h-3.5 w-3.5 mr-1" />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant={stockInfo.isLow ? "default" : "outline"}
                              className={stockInfo.isLow ? "gradient-coral text-white" : ""}
                              onClick={() => openRefillInvoice(med, i)}
                              data-testid={`refill-medicine-${i}`}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Refill
                            </Button>
                          </div>
                        </div>
                        <div className="mt-3">
                          <Progress
                            value={Math.min(100, ((med.tablet_stock_count || 0) / 30) * 100)}
                            className="h-2"
                            indicatorClassName={stockInfo.isLow ? 'bg-red-500' : 'bg-teal-500'}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            {/* Add / Edit Medicine Dialog — uses the SAME MedicationForm as PM Dashboard for full parity */}
            <Dialog open={showMedicineDialog} onOpenChange={(open) => { if (!open) { resetMedForm(); } setShowMedicineDialog(open); }}>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="medicine-dialog">
                <DialogHeader>
                  <DialogTitle>{editingMedicine ? 'Edit Medicine' : 'Add Medicine'}</DialogTitle>
                </DialogHeader>
                <MedicationForm
                  initialData={editingMedicine}
                  isEditMode={!!editingMedicine}
                  isPrescriptionManager={true}
                  onSubmit={handleMedicationFormSubmit}
                  onCancel={() => { setShowMedicineDialog(false); resetMedForm(); }}
                  loading={medicationFormLoading}
                  submitButtonText={editingMedicine ? 'Update Medicine' : 'Add Medicine'}
                />
              </DialogContent>
            </Dialog>

            {/* Custom Medicine Invoice Section (placed BELOW Current Medicines) */}
            <Card data-testid="medicine-invoice-section">
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <CardTitle className="text-lg font-semibold flex items-center gap-2">
                      <IndianRupee className="h-5 w-5 text-coral-500" />
                      Create Medicine Invoice
                    </CardTitle>
                    <p className="text-sm text-slate-500 mt-1">
                      Click "Refill" on any medicine above to auto-add it here, or add rows manually to generate an invoice.
                    </p>
                  </div>
                  <div
                    className="rounded-lg border border-teal-200 bg-teal-50/70 px-3 py-2 text-right shrink-0"
                    data-testid="monthly-invoice-amount-card"
                  >
                    <p className="text-[10px] font-medium uppercase tracking-wider text-teal-700/80">
                      Auto-Computed Monthly Invoice
                    </p>
                    <p
                      className="text-lg font-bold text-teal-800 tabular-nums flex items-center justify-end"
                      data-testid="monthly-invoice-amount-value"
                    >
                      <IndianRupee className="h-4 w-4" />
                      {(monthlyInvoiceAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Column headers */}
                <div className="grid grid-cols-[1.5fr_130px_140px_40px] gap-3 text-xs font-medium text-slate-500 uppercase tracking-wider px-1">
                  <span>Name of Medicine</span>
                  <span>Strips Required</span>
                  <span>Price (₹)</span>
                  <span></span>
                </div>

                {medicineInvoiceItems.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 text-sm border border-dashed border-slate-200 rounded-lg" data-testid="medicine-invoice-empty">
                    No medicines added yet. Click "Refill" on a medicine or "Add Item" below.
                  </div>
                ) : (
                  <div className="space-y-2" data-testid="medicine-invoice-items-list">
                    {medicineInvoiceItems.map((item, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-[1.5fr_130px_140px_40px] gap-3 items-center"
                        data-testid={`medicine-invoice-row-${idx}`}
                      >
                        <Input
                          value={item.name}
                          onChange={(e) => updateMedicineInvoiceItem(idx, "name", e.target.value)}
                          placeholder="e.g. Metformin 500mg"
                          data-testid={`medicine-invoice-name-${idx}`}
                        />
                        <Input
                          type="number"
                          value={item.strips}
                          onChange={(e) => updateMedicineInvoiceItem(idx, "strips", e.target.value)}
                          placeholder="e.g. 3"
                          min="0"
                          step="1"
                          data-testid={`medicine-invoice-strips-${idx}`}
                        />
                        <Input
                          type="number"
                          value={item.price}
                          onChange={(e) => updateMedicineInvoiceItem(idx, "price", e.target.value)}
                          placeholder="0.00"
                          min="0"
                          step="0.01"
                          data-testid={`medicine-invoice-price-${idx}`}
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9 text-slate-400 hover:text-red-500"
                          onClick={() => removeMedicineInvoiceItem(idx)}
                          data-testid={`medicine-invoice-remove-${idx}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add item */}
                <div>
                  <Button
                    type="button"
                    variant="outline"
                    className="text-teal-600 border-teal-200 hover:bg-[#2BA89F]/10"
                    onClick={addMedicineInvoiceRow}
                    data-testid="medicine-invoice-add-item-btn"
                  >
                    <Plus className="h-4 w-4 mr-1.5" />
                    Add Item
                  </Button>
                </div>

                {/* Pricing Summary (Total + Actual + Savings) */}
                <div className="pt-3 border-t border-slate-100 space-y-3" data-testid="medicine-invoice-pricing-summary">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-slate-500">Total Price</Label>
                    <span
                      className="text-xl font-bold text-slate-900 tabular-nums flex items-center"
                      data-testid="medicine-invoice-total-amount"
                    >
                      <IndianRupee className="h-4 w-4" />
                      {medicineInvoiceTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="medicine-invoice-actual-price" className="text-sm text-slate-500 shrink-0">
                      Actual Price
                    </Label>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 text-sm">₹</span>
                      <Input
                        id="medicine-invoice-actual-price"
                        type="number"
                        value={medicineInvoiceActualPrice}
                        onChange={(e) => setMedicineInvoiceActualPrice(e.target.value)}
                        placeholder="0.00"
                        min="0"
                        max={medicineInvoiceTotal || undefined}
                        step="0.01"
                        className="w-40 text-right"
                        data-testid="medicine-invoice-actual-price-input"
                      />
                    </div>
                  </div>
                  {medicineInvoiceActualPrice !== "" && !hasMedicineDiscount && medicineInvoiceTotal > 0 && (
                    <p className="text-xs text-red-500 text-right" data-testid="medicine-invoice-discount-error">
                      Actual Price must be between ₹0 and ₹{medicineInvoiceTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-slate-500">Savings</Label>
                    <span
                      className="text-xl font-bold text-green-600 tabular-nums flex items-center"
                      data-testid="medicine-invoice-savings-amount"
                    >
                      <IndianRupee className="h-4 w-4" />
                      {medicineInvoiceSavings.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex justify-end gap-2 pt-2 flex-wrap">
                  <Button
                    variant="outline"
                    onClick={resetMedicineInvoice}
                    data-testid="medicine-invoice-cancel-btn"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="outline"
                    className="border-teal-200 text-teal-700 hover:bg-[#2BA89F]/10"
                    onClick={handleGenerateMonthlyInvoice}
                    data-testid="medicine-invoice-generate-monthly-btn"
                  >
                    Generate Monthly Invoice
                  </Button>
                  <Button
                    className="gradient-coral text-white"
                    onClick={handleOpenMedicineInvoiceConfirm}
                    data-testid="medicine-invoice-generate-btn"
                  >
                    Generate Invoice
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Confirm Generate Monthly Invoice Dialog */}
            <Dialog open={showGenerateMonthlyConfirm} onOpenChange={setShowGenerateMonthlyConfirm}>
              <DialogContent className="max-w-md" data-testid="generate-monthly-invoice-confirm-dialog">
                <DialogHeader>
                  <DialogTitle>Generate Monthly Invoice</DialogTitle>
                  <DialogDescription>
                    The auto-computed monthly amount below will be added to {patient.name}'s Converted Revenue, and you'll be taken to the Invoice Creator to finalize and send the invoice.
                  </DialogDescription>
                </DialogHeader>
                <div className="rounded-lg border border-teal-200 bg-teal-50/70 px-4 py-3 my-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-teal-800">Monthly Invoice Amount</span>
                  <span
                    className="text-xl font-bold text-teal-800 tabular-nums flex items-center"
                    data-testid="generate-monthly-confirm-amount"
                  >
                    <IndianRupee className="h-4 w-4" />
                    {(monthlyInvoiceAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <DialogFooter className="gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowGenerateMonthlyConfirm(false)}
                    disabled={generatingMonthlyInvoice}
                    data-testid="generate-monthly-cancel-btn"
                  >
                    Cancel
                  </Button>
                  <Button
                    className="gradient-coral text-white"
                    onClick={handleConfirmGenerateMonthlyInvoice}
                    disabled={generatingMonthlyInvoice}
                    data-testid="generate-monthly-confirm-btn"
                  >
                    {generatingMonthlyInvoice ? "Processing..." : "Confirm & Continue"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Confirm Medicine Invoice Dialog */}
            <Dialog open={showMedicineInvoiceConfirm} onOpenChange={setShowMedicineInvoiceConfirm}>
              <DialogContent className="max-w-md" data-testid="medicine-invoice-confirm-dialog">
                <DialogHeader>
                  <DialogTitle>Confirm Customer Purchase</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 py-2">
                  <p className="text-sm text-slate-600">
                    Does <span className="font-semibold text-slate-800">{patient.name}</span> agree to purchase the following medicines?
                  </p>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 divide-y divide-slate-200">
                    {medicineInvoiceItems
                      .filter(it => it.name.trim() && parseFloat(it.strips) > 0 && parseFloat(it.price) > 0)
                      .map((it, i) => {
                        const rowTotal = (parseFloat(it.strips) || 0) * (parseFloat(it.price) || 0);
                        return (
                          <div key={i} className="flex items-center justify-between px-3 py-2 text-sm">
                            <span className="text-slate-700 truncate pr-2">
                              {it.name} <span className="text-slate-400">× {it.strips} strips</span>
                            </span>
                            <span className="text-slate-900 font-medium tabular-nums flex items-center">
                              <IndianRupee className="h-3.5 w-3.5" />
                              {rowTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        );
                      })}
                    <div className="flex items-center justify-between px-3 py-2 text-sm">
                      <span className="text-slate-600">Total Price</span>
                      <span className="font-semibold text-slate-900 tabular-nums flex items-center" data-testid="medicine-confirm-total-amount">
                        <IndianRupee className="h-3.5 w-3.5" />
                        {medicineInvoiceTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-3 py-2 text-sm">
                      <span className="text-slate-600">Actual Price</span>
                      <span className="font-semibold text-teal-700 tabular-nums flex items-center" data-testid="medicine-confirm-actual-amount">
                        <IndianRupee className="h-3.5 w-3.5" />
                        {effectiveMedicineActualPrice.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-3 py-2 text-sm bg-green-50">
                      <span className="font-semibold text-slate-700">Savings</span>
                      <span className="font-bold text-green-600 tabular-nums flex items-center" data-testid="medicine-confirm-savings-amount">
                        <IndianRupee className="h-4 w-4" />
                        {medicineInvoiceSavings.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setShowMedicineInvoiceConfirm(false)}
                    data-testid="medicine-invoice-confirm-cancel-btn"
                  >
                    Cancel
                  </Button>
                  <Button
                    className="gradient-teal text-white"
                    onClick={handleConfirmMedicineInvoice}
                    data-testid="medicine-invoice-confirm-btn"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1.5" />
                    I Confirm
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </TabsContent>

        {/* Vitals Tab */}
        <TabsContent value="vitals">
          <div className="space-y-4" data-testid="vitals-content">
            <div className="flex justify-end">
              <Dialog open={showVitalDialog} onOpenChange={setShowVitalDialog}>
                <DialogTrigger asChild>
                  <Button className="gradient-teal text-white" data-testid="add-vital-btn">
                    <Plus className="h-4 w-4 mr-2" />
                    Record Vital
                  </Button>
                </DialogTrigger>
                <DialogContent data-testid="vital-dialog">
                  <DialogHeader>
                    <DialogTitle>Record Vital</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select
                        value={newVital.type}
                        onValueChange={(v) => setNewVital({ ...newVital, type: v })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bp">Blood Pressure</SelectItem>
                          <SelectItem value="sugar">Blood Sugar</SelectItem>
                          <SelectItem value="weight">Weight</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {newVital.type === "bp" ? (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Systolic (mmHg)</Label>
                          <Input
                            type="number"
                            value={newVital.systolic}
                            onChange={(e) => setNewVital({ ...newVital, systolic: e.target.value })}
                            placeholder="120"
                            data-testid="systolic-input"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Diastolic (mmHg)</Label>
                          <Input
                            type="number"
                            value={newVital.diastolic}
                            onChange={(e) => setNewVital({ ...newVital, diastolic: e.target.value })}
                            placeholder="80"
                            data-testid="diastolic-input"
                          />
                        </div>
                      </div>
                    ) : newVital.type === "sugar" ? (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Blood Sugar (mg/dL)</Label>
                          <Input
                            type="number"
                            value={newVital.value}
                            onChange={(e) => setNewVital({ ...newVital, value: e.target.value })}
                            placeholder="120"
                            data-testid="vital-value-input"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Meal Context</Label>
                          <Select
                            value={newVital.meal_context}
                            onValueChange={(v) => setNewVital({ ...newVital, meal_context: v })}
                          >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Fasting">Fasting</SelectItem>
                              <SelectItem value="Before Breakfast">Before Breakfast</SelectItem>
                              <SelectItem value="After Breakfast">After Breakfast</SelectItem>
                              <SelectItem value="Before Lunch">Before Lunch</SelectItem>
                              <SelectItem value="After Lunch">After Lunch</SelectItem>
                              <SelectItem value="Before Dinner">Before Dinner</SelectItem>
                              <SelectItem value="After Dinner">After Dinner</SelectItem>
                              <SelectItem value="Random">Random</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label>Weight (kg)</Label>
                        <Input
                          type="number"
                          value={newVital.value}
                          onChange={(e) => setNewVital({ ...newVital, value: e.target.value })}
                          placeholder="70"
                          data-testid="vital-value-input"
                        />
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label>Notes (Optional)</Label>
                      <Textarea
                        value={newVital.notes}
                        onChange={(e) => setNewVital({ ...newVital, notes: e.target.value })}
                        placeholder="Any observations..."
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowVitalDialog(false)}>Cancel</Button>
                    <Button onClick={handleAddVital} className="gradient-teal text-white" data-testid="save-vital-btn">
                      Save Vital
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {/* BP Chart */}
            {bpData?.length > 0 && (
              <Card className="vital-bp">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Heart className="h-4 w-4 text-red-500" />
                    Blood Pressure Trend
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={bpData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                      <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" domain={[60, 180]} />
                      <Tooltip contentStyle={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                      <Legend />
                      <Line type="monotone" dataKey="systolic" stroke="#F44336" strokeWidth={2} dot={{ r: 4 }} name="Systolic" />
                      <Line type="monotone" dataKey="diastolic" stroke="#2196F3" strokeWidth={2} dot={{ r: 4 }} name="Diastolic" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Sugar Chart */}
            {sugarData?.length > 0 && (
              <Card className="vital-sugar">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Activity className="h-4 w-4 text-purple-500" />
                    Blood Sugar Trend
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={sugarData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                      <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" domain={[60, 250]} />
                      <Tooltip contentStyle={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px' }} />
                      <Line type="monotone" dataKey="value" stroke="#9C27B0" strokeWidth={2} dot={{ r: 4 }} name="Blood Sugar" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Recent Vitals */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent Readings</CardTitle>
              </CardHeader>
              <CardContent>
                {(patient.blood_pressure?.length === 0 && patient.blood_glucose?.length === 0 && patient.body_metrics?.length === 0) ? (
                  <p className="text-center text-slate-500 py-4">No vitals recorded</p>
                ) : (
                  <div className="space-y-2">
                    {/* BP readings */}
                    {patient.blood_pressure?.slice(0, 3).map((v, i) => (
                      <div key={`bp-${i}`} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-red-100 text-red-500">
                            <Heart className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">Blood Pressure</p>
                            <p className="text-xs text-slate-500">{v.date} at {v.time}</p>
                          </div>
                        </div>
                        <p className="text-lg font-semibold text-slate-900 tabular-nums">
                          {v.systolic}/{v.diastolic} mmHg
                        </p>
                      </div>
                    ))}
                    {/* Glucose readings */}
                    {patient.blood_glucose?.slice(0, 3).map((v, i) => (
                      <div key={`gl-${i}`} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-purple-100 text-purple-500">
                            <Activity className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">Blood Sugar ({v.meal_context})</p>
                            <p className="text-xs text-slate-500">{v.date} at {v.time}</p>
                          </div>
                        </div>
                        <p className="text-lg font-semibold text-slate-900 tabular-nums">
                          {v.value} mg/dL
                        </p>
                      </div>
                    ))}
                    {/* Body metrics */}
                    {patient.body_metrics?.slice(0, 3).map((v, i) => (
                      <div key={`bm-${i}`} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-blue-100 text-blue-500">
                            <TrendingUp className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">Weight / BMI</p>
                            <p className="text-xs text-slate-500">{v.date}</p>
                          </div>
                        </div>
                        <p className="text-lg font-semibold text-slate-900 tabular-nums">
                          {v.weight} kg (BMI: {v.bmi})
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Products Tab */}
        <TabsContent value="products">
          {patient.marketing_consent === 'do_not_contact' ? (
            <Card data-testid="products-blocked">
              <CardContent className="p-8 text-center">
                <div className="p-3 rounded-full bg-red-50 w-fit mx-auto mb-3">
                  <ShieldAlert className="h-8 w-8 text-red-400" />
                </div>
                <h3 className="font-semibold text-slate-700">Marketing Restricted</h3>
                <p className="text-sm text-slate-500 mt-1">This patient has opted out of all marketing outreach and product suggestions.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <Card data-testid="products-content">
              {patient.marketing_consent === 'moderate' && (
                <div className="mx-6 mt-4 p-3 rounded-lg border border-amber-200 bg-amber-50 flex items-center gap-2" data-testid="moderate-consent-warning">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                  <p className="text-xs text-amber-700">This patient has <span className="font-semibold">moderate</span> marketing consent — limit suggestions to medicine refills only. Avoid promotional outreach.</p>
                </div>
              )}
              <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold">
                    Suggested Products for {patient.name}
                  </CardTitle>
                  <p className="text-sm text-slate-500">
                    Based on patient's conditions: {patient.diseases?.join(", ")}
                  </p>
                </div>
                <a href="https://www.1mg.com/categories" target="_blank" rel="noopener noreferrer" data-testid="browse-1mg-link">
                  <Button variant="outline" size="sm" className="text-teal-600 border-teal-200 hover:bg-[#2BA89F]/10">
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                    Browse on 1mg
                  </Button>
                </a>
              </div>
            </CardHeader>
            <CardContent>
              {productSuggestions.length === 0 ? (
                <p className="text-center text-slate-500 py-8">No product suggestions available</p>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {productSuggestions.map((product, i) => (
                    <a
                      key={i}
                      href={`https://www.1mg.com/search/all?name=${encodeURIComponent(product.name)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-4 rounded-lg border border-slate-100 bg-gradient-to-r from-orange-50 to-white hover:shadow-md hover:border-teal-200 transition-all cursor-pointer"
                      data-testid={`product-suggestion-${i}`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <Badge variant="outline" className="mb-2 text-xs">
                            {product.disease}
                          </Badge>
                          <h4 className="font-medium text-slate-900">{product.name}</h4>
                          <p className="text-sm text-slate-500 mt-1">{product.purpose}</p>
                          <p className="text-sm font-semibold text-teal-600 mt-2" data-testid={`product-price-${i}`}>
                            {typeof product.price === 'number' && product.price > 0
                              ? `₹${product.price.toLocaleString('en-IN')}`
                              : <span className="text-xs text-slate-500 font-normal">Check price on 1mg</span>}
                          </p>
                        </div>
                        <div className={`p-2 rounded-lg ${product.category === 'equipment' ? 'bg-blue-100 text-blue-500' : 'bg-green-100 text-green-500'}`}>
                          <ShoppingBag className="h-5 w-5" />
                        </div>
                      </div>
                      <p className="text-xs text-teal-500 mt-2 flex items-center gap-1">
                        <ExternalLink className="h-3 w-3" /> Search on 1mg
                        {product.source === 'ai' && (
                          <span className="ml-2 text-[10px] uppercase tracking-wide text-purple-500 bg-purple-50 px-1.5 py-0.5 rounded">AI</span>
                        )}
                      </p>
                    </a>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

              {/* Custom Invoice / E-commerce Section (placed BELOW Suggested Products) */}
              <Card data-testid="custom-invoice-section">
                <CardHeader>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <CardTitle className="text-lg font-semibold flex items-center gap-2">
                        <IndianRupee className="h-5 w-5 text-coral-500" />
                        Create Product Invoice
                      </CardTitle>
                      <p className="text-sm text-slate-500 mt-1">
                        Add products sold to {patient.name} and generate an invoice for customer confirmation.
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Column headers */}
                  <div className="grid grid-cols-[1fr_160px_40px] gap-3 text-xs font-medium text-slate-500 uppercase tracking-wider px-1">
                    <span>Product Name</span>
                    <span>Price (₹)</span>
                    <span></span>
                  </div>

                  {/* Items */}
                  <div className="space-y-2" data-testid="invoice-items-list">
                    {invoiceItems.map((item, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-[1fr_160px_40px] gap-3 items-center"
                        data-testid={`invoice-item-row-${idx}`}
                      >
                        <Input
                          value={item.name}
                          onChange={(e) => updateInvoiceItem(idx, "name", e.target.value)}
                          placeholder="e.g. Dettol Antiseptic Liquid 500ml"
                          data-testid={`invoice-item-name-${idx}`}
                        />
                        <Input
                          type="number"
                          value={item.price}
                          onChange={(e) => updateInvoiceItem(idx, "price", e.target.value)}
                          placeholder="0.00"
                          min="0"
                          step="0.01"
                          data-testid={`invoice-item-price-${idx}`}
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9 text-slate-400 hover:text-red-500"
                          onClick={() => removeInvoiceItem(idx)}
                          disabled={invoiceItems.length === 1}
                          data-testid={`invoice-item-remove-${idx}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  {/* Add item */}
                  <div>
                    <Button
                      type="button"
                      variant="outline"
                      className="text-teal-600 border-teal-200 hover:bg-[#2BA89F]/10"
                      onClick={addInvoiceItemRow}
                      data-testid="invoice-add-item-btn"
                    >
                      <Plus className="h-4 w-4 mr-1.5" />
                      Add Item
                    </Button>
                  </div>

                  {/* Pricing Summary (Total + Discounted + Savings) */}
                  <div className="pt-3 border-t border-slate-100 space-y-3" data-testid="invoice-pricing-summary">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm text-slate-500">Total Price</Label>
                      <span
                        className="text-xl font-bold text-slate-900 tabular-nums flex items-center"
                        data-testid="invoice-total-amount"
                      >
                        <IndianRupee className="h-4 w-4" />
                        {invoiceTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <Label htmlFor="invoice-discounted-price" className="text-sm text-slate-500 shrink-0">
                        Discounted Price
                      </Label>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 text-sm">₹</span>
                        <Input
                          id="invoice-discounted-price"
                          type="number"
                          value={invoiceDiscountedPrice}
                          onChange={(e) => setInvoiceDiscountedPrice(e.target.value)}
                          placeholder="0.00"
                          min="0"
                          max={invoiceTotal || undefined}
                          step="0.01"
                          className="w-40 text-right"
                          data-testid="invoice-discounted-price-input"
                        />
                      </div>
                    </div>
                    {invoiceDiscountedPrice !== "" && !hasDiscount && invoiceTotal > 0 && (
                      <p className="text-xs text-red-500 text-right" data-testid="invoice-discount-error">
                        Discounted Price must be between ₹0 and ₹{invoiceTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    )}
                    <div className="flex items-center justify-between">
                      <Label className="text-sm text-slate-500">Savings</Label>
                      <span
                        className="text-xl font-bold text-green-600 tabular-nums flex items-center"
                        data-testid="invoice-savings-amount"
                      >
                        <IndianRupee className="h-4 w-4" />
                        {invoiceSavings.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      variant="outline"
                      onClick={resetInvoice}
                      data-testid="invoice-cancel-btn"
                    >
                      Cancel
                    </Button>
                    <Button
                      className="gradient-coral text-white"
                      onClick={handleOpenInvoiceConfirm}
                      data-testid="invoice-generate-btn"
                    >
                      Generate Invoice
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Confirm Invoice Dialog */}
              <Dialog open={showInvoiceConfirm} onOpenChange={setShowInvoiceConfirm}>
                <DialogContent className="max-w-md" data-testid="invoice-confirm-dialog">
                  <DialogHeader>
                    <DialogTitle>Confirm Customer Purchase</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3 py-2">
                    <p className="text-sm text-slate-600">
                      Does <span className="font-semibold text-slate-800">{patient.name}</span> agree to purchase the following products?
                    </p>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 divide-y divide-slate-200">
                      {invoiceItems
                        .filter(it => it.name.trim() && parseFloat(it.price) > 0)
                        .map((it, i) => (
                          <div key={i} className="flex items-center justify-between px-3 py-2 text-sm">
                            <span className="text-slate-700 truncate pr-2">{it.name}</span>
                            <span className="text-slate-900 font-medium tabular-nums flex items-center">
                              <IndianRupee className="h-3.5 w-3.5" />
                              {parseFloat(it.price).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        ))}
                      <div className="flex items-center justify-between px-3 py-2 text-sm">
                        <span className="text-slate-600">Total Price</span>
                        <span className="font-semibold text-slate-900 tabular-nums flex items-center" data-testid="confirm-total-amount">
                          <IndianRupee className="h-3.5 w-3.5" />
                          {invoiceTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex items-center justify-between px-3 py-2 text-sm">
                        <span className="text-slate-600">Discounted Price</span>
                        <span className="font-semibold text-teal-700 tabular-nums flex items-center" data-testid="confirm-discounted-amount">
                          <IndianRupee className="h-3.5 w-3.5" />
                          {effectiveDiscountedPrice.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex items-center justify-between px-3 py-2 text-sm bg-green-50">
                        <span className="font-semibold text-slate-700">Savings</span>
                        <span className="font-bold text-green-600 tabular-nums flex items-center" data-testid="confirm-savings-amount">
                          <IndianRupee className="h-4 w-4" />
                          {invoiceSavings.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setShowInvoiceConfirm(false)}
                      data-testid="invoice-confirm-cancel-btn"
                    >
                      Cancel
                    </Button>
                    <Button
                      className="gradient-teal text-white"
                      onClick={handleConfirmInvoice}
                      data-testid="invoice-confirm-btn"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1.5" />
                      I Confirm
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </TabsContent>

        {/* Lab Tests Tab */}
        <TabsContent value="labs">
          <div className="space-y-4" data-testid="labs-content">
            <div className="flex justify-end">
              <Button
                className="gradient-coral text-white"
                onClick={openLabFlow}
                data-testid="book-lab-test-btn"
              >
                <Plus className="h-4 w-4 mr-2" />
                Book Lab Test
              </Button>
            </div>

            {/* Step 1: Preference Dialog */}
            <Dialog
              open={labFlowStep === "preference"}
              onOpenChange={(open) => { if (!open && labFlowStep === "preference") resetLabFlow(); }}
            >
              <DialogContent className="max-w-md" data-testid="lab-preference-dialog">
                <DialogHeader>
                  <DialogTitle>Choose Lab Test Preference</DialogTitle>
                </DialogHeader>
                <div className="py-2">
                  <p className="text-sm text-slate-600 mb-4">
                    Does <span className="font-semibold text-slate-800">{patient.name}</span> prefer our featured lab tests or their own preferred lab?
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => chooseLabSource("featured")}
                      className="p-4 rounded-xl border-2 border-slate-200 hover:border-teal-400 hover:bg-[#2BA89F]/10 transition text-left group"
                      data-testid="lab-pref-featured-btn"
                    >
                      <div className="p-2 rounded-lg bg-teal-100 text-teal-600 w-fit mb-2 group-hover:scale-105 transition">
                        <FlaskConical className="h-5 w-5" />
                      </div>
                      <p className="font-semibold text-slate-800">Featured Tests</p>
                      <p className="text-xs text-slate-500 mt-1">Choose from our curated/recommended lab tests</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => chooseLabSource("preferred_lab")}
                      className="p-4 rounded-xl border-2 border-slate-200 hover:border-coral-400 hover:bg-orange-50 transition text-left group"
                      data-testid="lab-pref-preferred-btn"
                    >
                      <div className="p-2 rounded-lg bg-orange-100 text-orange-600 w-fit mb-2 group-hover:scale-105 transition">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <p className="font-semibold text-slate-800">Patient's Preferred Lab</p>
                      <p className="text-xs text-slate-500 mt-1">Enter tests manually for the patient's own lab</p>
                    </button>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={resetLabFlow} data-testid="lab-pref-cancel-btn">
                    Cancel
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Step 2a: Featured tests selection */}
            <Dialog
              open={labFlowStep === "featured_select"}
              onOpenChange={(open) => { if (!open && labFlowStep === "featured_select") resetLabFlow(); }}
            >
              <DialogContent className="max-w-lg max-h-[85vh] flex flex-col" data-testid="lab-featured-select-dialog">
                <DialogHeader className="shrink-0 border-b pb-3">
                  <DialogTitle>Select Featured Lab Tests</DialogTitle>
                  <DialogDescription className="text-xs text-slate-500">
                    Pick the laboratory and tick the tests the patient wants to perform.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4 overflow-y-auto flex-1 min-h-0 space-y-4">
                  {/* Lab selection (from Lab Test Catalog > Laboratories) */}
                  <div className="space-y-2" data-testid="lab-featured-lab-selector">
                    <Label>Select Laboratory <span className="text-red-500">*</span></Label>
                    {catalogLaboratories.length === 0 ? (
                      <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 text-xs text-amber-700" data-testid="no-laboratories-warning">
                        No laboratories found. Please add labs in the{" "}
                        <Link to="/crm/lab-tests" className="underline font-medium">Lab Test Catalog → Laboratories</Link>{" "}section first.
                      </div>
                    ) : (
                      <Select
                        value={labBookingForm.lab_name}
                        onValueChange={(v) => setLabBookingForm(f => ({ ...f, lab_name: v, use_custom_lab: false }))}
                      >
                        <SelectTrigger data-testid="lab-featured-lab-select">
                          <SelectValue placeholder="Choose a laboratory..." />
                        </SelectTrigger>
                        <SelectContent>
                          {catalogLaboratories.map((lab) => (
                            <SelectItem key={lab.id} value={lab.name}>
                              {lab.name}
                              {lab.city ? <span className="text-xs text-slate-400 ml-1">• {lab.city}</span> : null}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  {/* Featured suggestions */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Featured Tests</Label>
                      {(labSuggestions.length > 0 || customFeaturedTests.length > 0) && (() => {
                        const suggestedNames = labSuggestions.map(t => t.name);
                        const allSuggestedChecked = suggestedNames.length > 0 && suggestedNames.every(n => !!featuredSelections[n]);
                        const allCustomChecked = customFeaturedTests.length === 0 || customFeaturedTests.every(t => t.selected);
                        const allChecked = allSuggestedChecked && allCustomChecked;
                        return (
                          <label
                            className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none hover:text-teal-600"
                            data-testid="lab-featured-select-all-label"
                          >
                            <input
                              type="checkbox"
                              checked={allChecked}
                              onChange={toggleSelectAllFeatured}
                              className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                              data-testid="lab-featured-select-all-checkbox"
                            />
                            <span className="font-medium">Select All</span>
                          </label>
                        );
                      })()}
                    </div>
                    {labSuggestions.length === 0 ? (
                      <p className="text-sm text-slate-400 italic">No featured tests available for this patient.</p>
                    ) : labSuggestions.map((test, i) => {
                      const checked = !!featuredSelections[test.name];
                      return (
                        <label
                          key={i}
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${checked ? "border-teal-500 bg-teal-50" : "border-slate-200 hover:border-teal-200"}`}
                          data-testid={`lab-featured-option-${i}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleFeaturedSelection(test.name)}
                            className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                            data-testid={`lab-featured-checkbox-${i}`}
                          />
                          <div className="flex-1">
                            <p className="font-medium text-slate-900 text-sm">{test.name}</p>
                            <p className="text-xs text-slate-500">Frequency: Every {test.frequency_months} months</p>
                          </div>
                          <p className="font-semibold text-teal-600 text-sm tabular-nums">₹{Number(test.price).toLocaleString('en-IN')}</p>
                        </label>
                      );
                    })}
                  </div>

                  {/* Custom-added tests list (also selectable) */}
                  {customFeaturedTests.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Added Manually</p>
                      {customFeaturedTests.map((t, i) => (
                        <div
                          key={i}
                          className={`flex items-center gap-3 p-3 rounded-lg border ${t.selected ? "border-coral-400 bg-orange-50" : "border-slate-200"}`}
                          data-testid={`lab-custom-test-${i}`}
                        >
                          <input
                            type="checkbox"
                            checked={!!t.selected}
                            onChange={() => toggleCustomFeaturedSelection(i)}
                            className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-900 text-sm truncate">{t.name}</p>
                          </div>
                          <p className="font-semibold text-coral-500 text-sm tabular-nums">₹{Number(t.price).toLocaleString('en-IN')}</p>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-slate-400 hover:text-red-500"
                            onClick={() => removeCustomFeaturedTest(i)}
                            data-testid={`lab-custom-test-remove-${i}`}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add custom test row */}
                  <div className="p-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 space-y-2">
                    <p className="text-xs font-medium text-slate-600">Add another test manually</p>
                    <div className="grid grid-cols-[1fr_120px_auto] gap-2 items-center">
                      <Input
                        value={customFeaturedInput.name}
                        onChange={(e) => setCustomFeaturedInput(v => ({ ...v, name: e.target.value }))}
                        placeholder="e.g. Vitamin D 25-OH"
                        data-testid="lab-custom-test-name-input"
                      />
                      <Input
                        type="number"
                        value={customFeaturedInput.price}
                        onChange={(e) => setCustomFeaturedInput(v => ({ ...v, price: e.target.value }))}
                        placeholder="Price ₹"
                        min="0"
                        step="1"
                        data-testid="lab-custom-test-price-input"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="text-teal-600 border-teal-200 hover:bg-[#2BA89F]/10"
                        onClick={addCustomFeaturedTest}
                        data-testid="lab-custom-test-add-btn"
                      >
                        <Plus className="h-4 w-4 mr-1" /> Add
                      </Button>
                    </div>
                  </div>

                  {/* Pricing Summary (Total + Actual + Savings) */}
                  <div className="pt-3 border-t border-slate-100 space-y-3" data-testid="lab-featured-pricing-summary">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm text-slate-500">Total Amount</Label>
                      <span
                        className="text-xl font-bold text-slate-900 tabular-nums flex items-center"
                        data-testid="lab-featured-total-amount"
                      >
                        <IndianRupee className="h-4 w-4" />
                        {labFeaturedTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <Label htmlFor="lab-featured-actual-amount" className="text-sm text-slate-500 shrink-0">
                        Actual Amount (after discount)
                      </Label>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 text-sm">₹</span>
                        <Input
                          id="lab-featured-actual-amount"
                          type="number"
                          value={labDiscountedAmount}
                          onChange={(e) => setLabDiscountedAmount(e.target.value)}
                          placeholder="0.00"
                          min="0"
                          max={labFeaturedTotal || undefined}
                          step="0.01"
                          className="w-40 text-right"
                          data-testid="lab-featured-actual-amount-input"
                        />
                      </div>
                    </div>
                    {labDiscountedAmount !== "" && !hasLabFeaturedDiscount && labFeaturedTotal > 0 && (
                      <p className="text-xs text-red-500 text-right" data-testid="lab-featured-discount-error">
                        Actual Amount must be between ₹0 and ₹{labFeaturedTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    )}
                    <div className="flex items-center justify-between">
                      <Label className="text-sm text-slate-500">Total Savings</Label>
                      <span
                        className="text-xl font-bold text-green-600 tabular-nums flex items-center"
                        data-testid="lab-featured-savings-amount"
                      >
                        <IndianRupee className="h-4 w-4" />
                        {labFeaturedSavings.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
                <DialogFooter className="shrink-0 border-t pt-3">
                  <Button variant="outline" onClick={resetLabFlow} data-testid="lab-featured-cancel-btn">Cancel</Button>
                  <Button
                    onClick={proceedFromFeaturedToBooking}
                    className="gradient-coral text-white"
                    data-testid="lab-featured-book-btn"
                  >
                    Book Test ({getSelectedFeaturedTests().length})
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Step 3: Booking details (common for both paths) */}
            <Dialog
              open={labFlowStep === "booking"}
              onOpenChange={(open) => { if (!open && labFlowStep === "booking") resetLabFlow(); }}
            >
              <DialogContent className="max-w-lg max-h-[90vh] flex flex-col" data-testid="lab-booking-dialog">
                <DialogHeader className="shrink-0 border-b pb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-indigo-100 text-indigo-600">
                      <FlaskConical className="h-5 w-5" />
                    </div>
                    <div>
                      <DialogTitle>Book Lab Test</DialogTitle>
                      <p className="text-xs text-slate-500">For {patient.name}</p>
                    </div>
                  </div>
                </DialogHeader>
                <div className="py-4 overflow-y-auto flex-1 min-h-0 space-y-4">
                  {/* Tests */}
                  <div className="space-y-2">
                    <Label>Tests</Label>
                    {labSource === "featured" ? (
                      <div className="space-y-2 rounded-lg border border-slate-200 p-3 bg-slate-50" data-testid="lab-booking-tests-readonly">
                        {getFinalTestsForBooking().length === 0 ? (
                          <p className="text-xs text-slate-400 italic">No tests selected. Go back and pick at least one.</p>
                        ) : getFinalTestsForBooking().map((t, i) => (
                          <div key={i} className="flex items-center justify-between text-sm">
                            <span className="text-slate-700">{t.name}</span>
                            <span className="text-slate-900 font-medium tabular-nums">₹{t.price.toLocaleString('en-IN')}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-2" data-testid="lab-booking-tests-editable">
                        {preferredTests.map((t, idx) => (
                          <div key={idx} className="grid grid-cols-[1fr_120px_40px] gap-2 items-center">
                            <Input
                              value={t.name}
                              onChange={(e) => updatePreferredTest(idx, "name", e.target.value)}
                              placeholder={`Test ${idx + 1} name`}
                              data-testid={`lab-preferred-test-name-${idx}`}
                            />
                            <Input
                              type="number"
                              value={t.price}
                              onChange={(e) => updatePreferredTest(idx, "price", e.target.value)}
                              placeholder="Price ₹"
                              min="0"
                              step="1"
                              data-testid={`lab-preferred-test-price-${idx}`}
                            />
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-9 w-9 text-slate-400 hover:text-red-500"
                              onClick={() => removePreferredTestRow(idx)}
                              disabled={preferredTests.length === 1}
                              data-testid={`lab-preferred-test-remove-${idx}`}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="text-teal-600 border-teal-200 hover:bg-[#2BA89F]/10"
                          onClick={addPreferredTestRow}
                          data-testid="lab-preferred-test-add-btn"
                        >
                          <Plus className="h-4 w-4 mr-1" /> Add Test
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Lab Name */}
                  <div className="space-y-2">
                    <Label>Lab Name</Label>
                    {labSource === "featured" ? (
                      <div
                        className="flex items-center gap-2 p-2.5 rounded-md border border-slate-200 bg-slate-50"
                        data-testid="lab-booking-lab-readonly"
                      >
                        <Building2 className="h-4 w-4 text-slate-400" />
                        <span className="text-sm text-slate-800 font-medium flex-1">
                          {labBookingForm.lab_name || "—"}
                        </span>
                        <span className="text-xs text-slate-400">(from catalog)</span>
                      </div>
                    ) : !labBookingForm.use_custom_lab ? (
                      <div className="flex gap-2">
                        <Select
                          value={labBookingForm.lab_name}
                          onValueChange={(v) => setLabBookingForm(f => ({ ...f, lab_name: v }))}
                        >
                          <SelectTrigger className="flex-1" data-testid="lab-name-select">
                            <SelectValue placeholder={pastLabNames.length ? "Choose a lab..." : "No previous labs — click + New"} />
                          </SelectTrigger>
                          <SelectContent>
                            {pastLabNames.length === 0 ? (
                              <div className="px-2 py-1.5 text-xs text-slate-400">No previously used labs</div>
                            ) : pastLabNames.map((n, i) => (
                              <SelectItem key={i} value={n}>{n}</SelectItem>
                            ))}
                            {patient.regular_lab_details && !pastLabNames.includes(patient.regular_lab_details) && (
                              <SelectItem value={patient.regular_lab_details}>
                                {patient.regular_lab_details} <span className="text-xs text-slate-400">(regular)</span>
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="outline"
                          className="text-teal-600 border-teal-200 hover:bg-[#2BA89F]/10"
                          onClick={() => setLabBookingForm(f => ({ ...f, use_custom_lab: true, lab_name: "" }))}
                          data-testid="lab-name-new-btn"
                        >
                          <Plus className="h-4 w-4 mr-1" /> New
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Input
                          value={labBookingForm.custom_lab_name}
                          onChange={(e) => setLabBookingForm(f => ({ ...f, custom_lab_name: e.target.value }))}
                          placeholder="Enter lab name"
                          data-testid="lab-name-custom-input"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          className="text-slate-500"
                          onClick={() => setLabBookingForm(f => ({ ...f, use_custom_lab: false, custom_lab_name: "" }))}
                          data-testid="lab-name-back-btn"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Date & Time */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Date</Label>
                      <Input
                        type="date"
                        value={labBookingForm.date}
                        onChange={(e) => setLabBookingForm(f => ({ ...f, date: e.target.value }))}
                        min={new Date().toISOString().split("T")[0]}
                        data-testid="lab-booking-date-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Time</Label>
                      <Input
                        type="time"
                        value={labBookingForm.time}
                        onChange={(e) => setLabBookingForm(f => ({ ...f, time: e.target.value }))}
                        data-testid="lab-booking-time-input"
                      />
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="space-y-2">
                    <Label>Notes (Optional)</Label>
                    <Textarea
                      value={labBookingForm.notes}
                      onChange={(e) => setLabBookingForm(f => ({ ...f, notes: e.target.value }))}
                      placeholder="Any special instructions..."
                      rows={2}
                      data-testid="lab-booking-notes-input"
                    />
                  </div>

                  {/* Total Amount Payable */}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <span className="text-sm text-slate-500">Total Amount Payable</span>
                    <span
                      className="text-xl font-bold text-teal-700 tabular-nums flex items-center"
                      data-testid="lab-booking-total"
                    >
                      <IndianRupee className="h-4 w-4" />
                      {labBookingTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
                <DialogFooter className="shrink-0 border-t pt-3">
                  {labSource === "featured" && (
                    <Button
                      variant="ghost"
                      className="mr-auto text-slate-600"
                      onClick={() => setLabFlowStep("featured_select")}
                      data-testid="lab-booking-back-btn"
                    >
                      <ArrowLeft className="h-4 w-4 mr-1" /> Back
                    </Button>
                  )}
                  <Button variant="outline" onClick={resetLabFlow} data-testid="lab-booking-cancel-btn">
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSubmitLabBooking}
                    className="gradient-coral text-white"
                    data-testid="lab-booking-submit-btn"
                  >
                    Book Lab Test
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Booked Tests */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Booked Lab Tests</CardTitle>
              </CardHeader>
              <CardContent>
                {patient.lab_tests?.length === 0 ? (
                  <p className="text-center text-slate-500 py-4">No lab tests booked</p>
                ) : (
                  <div className="space-y-3">
                    {patient.lab_tests?.map((test, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-slate-50" data-testid={`booked-lab-test-${i}`}>
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-purple-100 text-purple-500">
                            <FlaskConical className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{test.test_name}</p>
                            <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500 flex-wrap">
                              {test.lab_name && <span>{test.lab_name}</span>}
                              {test.booked_date && (
                                <span>
                                  {new Date(test.booked_date).toLocaleDateString('en-IN')}
                                  {test.scheduled_time ? ` • ${test.scheduled_time}` : ''}
                                </span>
                              )}
                              {typeof test.price === 'number' && test.price > 0 && (
                                <span className="text-green-600 font-medium">₹{test.price.toLocaleString('en-IN')}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <Badge variant="outline" className="capitalize">{test.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recommended Tests */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recommended Lab Tests</CardTitle>
              </CardHeader>
              <CardContent>
                {labSuggestions.length === 0 ? (
                  <p className="text-center text-slate-500 py-4">No recommendations</p>
                ) : (
                  <div className="grid md:grid-cols-2 gap-3">
                    {labSuggestions.map((test, i) => (
                      <div key={i} className="p-3 rounded-lg border border-slate-100 bg-gradient-to-r from-purple-50 to-white">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-slate-900">{test.name}</p>
                            <p className="text-xs text-slate-500">
                              For: {test.diseases?.join(", ")}
                            </p>
                          </div>
                          <p className="font-semibold text-purple-600">₹{test.price}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Invoices & Orders Tab */}
        <TabsContent value="invoices-orders">
          <div className="space-y-4" data-testid="invoices-orders-content">
            {/* Update New Invoice — same shared Purchase Links panel as PM (no page jump) */}
            <PurchaseLinksPanel
              userId={id}
              userName={patient?.name || ""}
              mode="inline"
              onSaved={() => fetchInvoicesAndOrders()}
            />

            {/* Invoice History */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4 text-teal-500" />
                    Invoice History
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={fetchInvoicesAndOrders}
                      disabled={invoicesLoading}
                      data-testid="refresh-invoices-btn"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 mr-1 ${invoicesLoading ? "animate-spin" : ""}`} />
                      Refresh
                    </Button>
                    <Button
                      size="sm"
                      className="gradient-teal text-white"
                      onClick={() => navigate(`/invoice-manager/invoices/create?userId=${id}`)}
                      data-testid="new-invoice-from-tab-btn"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> New Invoice
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  All invoices generated for this patient via the Invoice Manager.
                </p>
              </CardHeader>
              <CardContent>
                {invoicesData.invoices?.length === 0 ? (
                  <p className="text-center text-slate-500 py-8 text-sm">No invoices generated yet</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm" data-testid="invoices-table">
                      <thead>
                        <tr className="text-left text-xs text-slate-500 border-b">
                          <th className="py-2 pr-3">Invoice #</th>
                          <th className="py-2 pr-3">Date</th>
                          <th className="py-2 pr-3">Type</th>
                          <th className="py-2 pr-3 text-right">Amount</th>
                          <th className="py-2 pr-3">Status</th>
                          <th className="py-2 pr-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoicesData.invoices.map((inv, i) => (
                          <tr key={inv.invoice_id || i} className="border-b last:border-b-0 hover:bg-slate-50" data-testid={`invoice-row-${i}`}>
                            <td className="py-2 pr-3 font-medium text-slate-800">{inv.invoice_number || inv.invoice_id?.slice(0, 8)}</td>
                            <td className="py-2 pr-3 text-slate-600">
                              {inv.created_at ? new Date(inv.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                            </td>
                            <td className="py-2 pr-3 text-slate-600 capitalize">{(inv.invoice_type || "tax_invoice").replace(/_/g, " ")}</td>
                            <td className="py-2 pr-3 text-right font-semibold text-emerald-700">
                              ₹{Number(inv.grand_total || 0).toLocaleString("en-IN")}
                            </td>
                            <td className="py-2 pr-3">
                              <Badge
                                variant="secondary"
                                className={
                                  inv.payment_status === "paid"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : inv.payment_status === "unpaid"
                                      ? "bg-amber-100 text-amber-700"
                                      : "bg-slate-100 text-slate-600"
                                }
                              >
                                {inv.payment_status || "draft"}
                              </Badge>
                            </td>
                            <td className="py-2 pr-3 text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate(`/invoice-manager/invoices/${inv.invoice_id}`)}
                                data-testid={`view-invoice-${i}`}
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Interactions Tab */}
        <TabsContent value="interactions">
          <Card data-testid="interactions-content">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Interaction History</CardTitle>
            </CardHeader>
            <CardContent>
              {patient.interactions?.length === 0 ? (
                <p className="text-center text-slate-500 py-8">No interactions logged</p>
              ) : (
                <div className="space-y-4">
                  {patient.interactions?.slice().reverse().map((interaction, i) => (
                    <div key={i} className="p-4 rounded-lg border border-slate-100 bg-slate-50" data-testid={`interaction-item-${i}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg ${
                            interaction.type === 'call' ? 'bg-green-100 text-green-500' :
                            interaction.type === 'message' ? 'bg-blue-100 text-blue-500' :
                            'bg-orange-100 text-orange-500'
                          }`}>
                            {interaction.type === 'call' ? <Phone className="h-4 w-4" /> :
                             interaction.type === 'message' ? <MessageSquare className="h-4 w-4" /> :
                             <User className="h-4 w-4" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-slate-900 capitalize">{interaction.type}</p>
                              {interaction.purpose && interaction.purpose.split(", ").map((p, j) => (
                                <Badge key={j} variant="outline" className="text-xs bg-teal-50 text-teal-700 border-teal-200" data-testid={`interaction-purpose-${i}-${j}`}>
                                  {p}
                                </Badge>
                              ))}
                              <Badge variant="outline" className={`text-xs ${
                                interaction.outcome === 'positive' ? 'bg-green-50 text-green-700' :
                                interaction.outcome === 'negative' ? 'bg-red-50 text-red-700' :
                                'bg-slate-50 text-slate-700'
                              }`}>
                                {interaction.outcome}
                              </Badge>
                            </div>
                            <p className="text-sm text-slate-600 mt-1">{interaction.notes}</p>
                            <p className="text-xs text-slate-400 mt-2">
                              {new Date(interaction.created_at).toLocaleDateString('en-IN', {
                                day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                              })}
                              {interaction.follow_up_date && (
                                <span className="ml-3 text-teal-600">
                                  <Calendar className="h-3 w-3 inline mr-1" />
                                  Follow-up: {new Date(interaction.follow_up_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                  {interaction.follow_up_time && ` at ${interaction.follow_up_time}`}
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Doctor Booking Tab */}
        <TabsContent value="doctor-booking">
          <div className="space-y-4" data-testid="doctor-booking-content">
            <div className="flex justify-end">
              <Dialog open={showApptDialog} onOpenChange={setShowApptDialog}>
                <DialogTrigger asChild>
                  <Button className="gradient-teal text-white" data-testid="book-appointment-btn">
                    <Plus className="h-4 w-4 mr-2" />
                    Book Appointment
                  </Button>
                </DialogTrigger>
                <DialogContent data-testid="appointment-dialog">
                  <DialogHeader>
                    <DialogTitle>Book Doctor Appointment</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Appointment Type</Label>
                        <Select value={apptForm.type} onValueChange={(v) => setApptForm({...apptForm, type: v})}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="doctor">Doctor Visit</SelectItem>
                            <SelectItem value="lab">Lab Visit</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Title</Label>
                        <Input value={apptForm.title} onChange={(e) => setApptForm({...apptForm, title: e.target.value})} placeholder="e.g., Regular Checkup" data-testid="appt-title" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Doctor Name</Label>
                        <Input value={apptForm.doctor} onChange={(e) => setApptForm({...apptForm, doctor: e.target.value})} placeholder="e.g., Dr. Suresh Reddy" data-testid="appt-doctor" />
                      </div>
                      <div className="space-y-2">
                        <Label>Hospital / Clinic</Label>
                        <Input value={apptForm.hospital} onChange={(e) => setApptForm({...apptForm, hospital: e.target.value})} placeholder="e.g., Apollo Hospital" data-testid="appt-hospital" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Date <span className="text-red-500">*</span></Label>
                        <Input type="date" value={apptForm.date} onChange={(e) => setApptForm({...apptForm, date: e.target.value})} data-testid="appt-date" />
                      </div>
                      <div className="space-y-2">
                        <Label>Time <span className="text-red-500">*</span></Label>
                        <Input type="time" value={apptForm.time} onChange={(e) => setApptForm({...apptForm, time: e.target.value})} data-testid="appt-time" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Location / Address</Label>
                      <Input value={apptForm.location} onChange={(e) => setApptForm({...apptForm, location: e.target.value})} placeholder="e.g., MG Road, Bangalore" data-testid="appt-location" />
                    </div>
                    <div className="space-y-2">
                      <Label>Notes</Label>
                      <Textarea value={apptForm.notes} onChange={(e) => setApptForm({...apptForm, notes: e.target.value})} placeholder="Any special instructions or reason for visit..." data-testid="appt-notes" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowApptDialog(false)}>Cancel</Button>
                    <Button onClick={handleBookAppointment} className="gradient-teal text-white" data-testid="save-appointment-btn">
                      Book Appointment
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {/* Upcoming Appointments */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-blue-500" />
                  Upcoming Appointments
                </CardTitle>
              </CardHeader>
              <CardContent>
                {doctorAppointments.filter(a => a.status === "upcoming").length === 0 ? (
                  <p className="text-center text-slate-500 py-4">No upcoming appointments</p>
                ) : (
                  <div className="space-y-3">
                    {doctorAppointments.filter(a => a.status === "upcoming").map((appt) => (
                      <div key={appt.id} className="p-4 rounded-lg border border-blue-100 bg-blue-50/50" data-testid={`appt-upcoming-${appt.id}`}>
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
                              <Stethoscope className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="font-medium text-slate-900">{appt.title}</p>
                              {appt.doctor && <p className="text-sm text-slate-600">{appt.doctor}</p>}
                              {appt.hospital && <p className="text-sm text-slate-500"><Building2 className="h-3 w-3 inline mr-1" />{appt.hospital}</p>}
                              {appt.location && <p className="text-xs text-slate-400"><MapPin className="h-3 w-3 inline mr-1" />{appt.location}</p>}
                              <p className="text-xs text-slate-500 mt-1">
                                <Calendar className="h-3 w-3 inline mr-1" />
                                {new Date(appt.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} at {appt.time}
                              </p>
                              {appt.notes && <p className="text-xs text-slate-400 mt-1 italic">{appt.notes}</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Select onValueChange={(v) => handleAppointmentStatus(appt.id, v)}>
                              <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue placeholder="Update Status" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="done">Completed</SelectItem>
                                <SelectItem value="postponed">Postponed</SelectItem>
                                <SelectItem value="abandoned">Abandoned</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Appointment History */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4 text-slate-500" />
                  Appointment History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {doctorAppointments.filter(a => a.status !== "upcoming").length === 0 ? (
                  <p className="text-center text-slate-500 py-4">No past appointments</p>
                ) : (
                  <div className="space-y-2">
                    {doctorAppointments.filter(a => a.status !== "upcoming").map((appt) => {
                      const statusConfig = {
                        done: { label: "Completed", color: "bg-green-50 text-green-700 border-green-200" },
                        postponed: { label: "Postponed", color: "bg-amber-50 text-amber-700 border-amber-200" },
                        abandoned: { label: "Abandoned", color: "bg-red-50 text-red-700 border-red-200" },
                      };
                      const sc = statusConfig[appt.status] || { label: appt.status, color: "bg-slate-50 text-slate-700" };
                      return (
                        <div key={appt.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50" data-testid={`appt-history-${appt.id}`}>
                          <div className="flex items-center gap-3">
                            <div className={`p-1.5 rounded-lg ${appt.status === 'done' ? 'bg-green-100 text-green-600' : appt.status === 'postponed' ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600'}`}>
                              {appt.status === 'done' ? <CheckCircle2 className="h-4 w-4" /> : <Stethoscope className="h-4 w-4" />}
                            </div>
                            <div>
                              <p className="font-medium text-sm text-slate-900">{appt.title}</p>
                              <p className="text-xs text-slate-500">
                                {appt.doctor && `${appt.doctor} • `}{appt.hospital || appt.location || ''}
                              </p>
                              <p className="text-xs text-slate-400">
                                {new Date(appt.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} at {appt.time}
                              </p>
                            </div>
                          </div>
                          <Badge variant="outline" className={`text-xs ${sc.color}`}>{sc.label}</Badge>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
