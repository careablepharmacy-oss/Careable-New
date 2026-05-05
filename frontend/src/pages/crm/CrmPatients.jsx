import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  Search,
  Filter,
  Plus,
  Phone,
  ChevronRight,
  AlertTriangle,
  Pill,
  Activity,
  User,
  RefreshCw,
  Ban
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getPatients, createPatient } from "@/lib/crmApi";

const DISEASES = [
  "Diabetes", "Hypertension", "Heart Disease", "Thyroid",
  "Arthritis", "Elderly Care", "Respiratory"
];

export default function Patients() {
  const [searchParams] = useSearchParams();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [diseaseFilter, setDiseaseFilter] = useState(searchParams.get("disease") || "all");
  const [priorityFilter, setPriorityFilter] = useState(searchParams.get("priority") || "all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newPatient, setNewPatient] = useState({
    name: "",
    age: "",
    sex: "Male",
    phone: "",
    email: "",
    address: "",
    city: "",
    state: ""
  });

  const fetchPatients = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (diseaseFilter && diseaseFilter !== "all") params.disease = diseaseFilter;
      if (priorityFilter && priorityFilter !== "all") params.priority = priorityFilter;

      const res = await getPatients(params);
      setPatients(res.data);
    } catch (error) {
      toast.error("Failed to fetch patients");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, [diseaseFilter, priorityFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPatients();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleAddPatient = async () => {
    try {
      await createPatient({
        name: newPatient.name,
        age: parseInt(newPatient.age) || undefined,
        sex: newPatient.sex,
        phone: newPatient.phone,
        email: newPatient.email || undefined,
        address: newPatient.address || undefined,
        city: newPatient.city || undefined,
        state: newPatient.state || undefined
      });
      toast.success("Patient added successfully!");
      setShowAddDialog(false);
      setNewPatient({ name: "", age: "", sex: "Male", phone: "", email: "", address: "", city: "", state: "" });
      fetchPatients();
    } catch (error) {
      toast.error("Failed to add patient");
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "high": return "bg-red-100 text-red-700 border-red-200";
      case "medium": return "bg-orange-100 text-orange-700 border-orange-200";
      default: return "bg-green-100 text-green-700 border-green-200";
    }
  };

  const getDiseaseColor = (disease) => {
    const colors = {
      "Diabetes": "bg-purple-100 text-purple-700",
      "Hypertension": "bg-red-100 text-red-700",
      "Heart Disease": "bg-pink-100 text-pink-700",
      "Thyroid": "bg-blue-100 text-blue-700",
      "Arthritis": "bg-orange-100 text-orange-700",
      "Elderly Care": "bg-green-100 text-green-700",
      "Respiratory": "bg-teal-100 text-teal-700"
    };
    return colors[disease] || "bg-slate-100 text-slate-700";
  };

  const getLocationText = (patient) => {
    const parts = [patient.city, patient.state].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : "";
  };

  return (
    <div className="space-y-6" data-testid="patients-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Patients</h1>
          <p className="text-slate-500 text-sm">{patients.length} patients found</p>
        </div>

        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button className="gradient-teal text-white" data-testid="add-patient-btn">
              <Plus className="h-4 w-4 mr-2" />
              Add Patient
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md" data-testid="add-patient-dialog">
            <DialogHeader>
              <DialogTitle>Add New Patient</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input
                  value={newPatient.name}
                  onChange={(e) => setNewPatient({ ...newPatient, name: e.target.value })}
                  placeholder="Enter patient name"
                  data-testid="patient-name-input"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Age</Label>
                  <Input
                    type="number"
                    value={newPatient.age}
                    onChange={(e) => setNewPatient({ ...newPatient, age: e.target.value })}
                    placeholder="Age"
                    data-testid="patient-age-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Sex</Label>
                  <Select
                    value={newPatient.sex}
                    onValueChange={(v) => setNewPatient({ ...newPatient, sex: v })}
                  >
                    <SelectTrigger data-testid="patient-sex-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={newPatient.phone}
                  onChange={(e) => setNewPatient({ ...newPatient, phone: e.target.value })}
                  placeholder="+91 XXXXX XXXXX"
                  data-testid="patient-phone-input"
                />
              </div>
              <div className="space-y-2">
                <Label>Email (Optional)</Label>
                <Input
                  type="email"
                  value={newPatient.email}
                  onChange={(e) => setNewPatient({ ...newPatient, email: e.target.value })}
                  placeholder="email@example.com"
                  data-testid="patient-email-input"
                />
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input
                  value={newPatient.address}
                  onChange={(e) => setNewPatient({ ...newPatient, address: e.target.value })}
                  placeholder="Street address"
                  data-testid="patient-address-input"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>City</Label>
                  <Input
                    value={newPatient.city}
                    onChange={(e) => setNewPatient({ ...newPatient, city: e.target.value })}
                    placeholder="City"
                    data-testid="patient-city-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>State</Label>
                  <Input
                    value={newPatient.state}
                    onChange={(e) => setNewPatient({ ...newPatient, state: e.target.value })}
                    placeholder="State"
                    data-testid="patient-state-input"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
              <Button onClick={handleAddPatient} className="gradient-teal text-white" data-testid="save-patient-btn">
                Save Patient
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or phone..."
                  className="pl-10"
                  data-testid="patient-search-input"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Select value={diseaseFilter} onValueChange={setDiseaseFilter}>
                <SelectTrigger className="w-[160px]" data-testid="disease-filter">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Disease" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Diseases</SelectItem>
                  {DISEASES.map(d => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-[140px]" data-testid="priority-filter">
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Patient List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-teal-600" />
        </div>
      ) : patients.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <User className="h-16 w-16 mx-auto mb-4 text-slate-300" />
            <h3 className="text-lg font-semibold text-slate-700">No patients found</h3>
            <p className="text-slate-500 mt-1">Add your first patient to get started</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {patients.map((patient, i) => (
            <Link to={`/crm/patients/${patient.id}`} key={patient.id}>
              <Card className="card-hover cursor-pointer" data-testid={`patient-card-${i}`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <div className="relative">
                      {patient.picture ? (
                        <img
                          src={patient.picture}
                          alt={patient.name}
                          className="w-14 h-14 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#2BA89F] to-[#1E3A5F] flex items-center justify-center text-white text-xl font-semibold">
                          {patient.name.charAt(0)}
                        </div>
                      )}
                      {patient.priority === "high" && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white animate-pulse" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-900 truncate">{patient.name}</h3>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="outline" className={`${getPriorityColor(patient.priority)} cursor-help`} data-testid={`priority-badge-${i}`}>
                                {patient.priority}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs text-xs">
                              <p data-testid={`priority-reason-${i}`}>{patient.priority_reason || "No reason available"}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        {patient.marketing_consent && (
                          <Badge variant="outline" className={`text-xs ${
                            patient.marketing_consent === 'open' ? 'bg-green-50 text-green-600 border-green-200' :
                            patient.marketing_consent === 'moderate' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                            'bg-red-50 text-red-600 border-red-200'
                          }`} data-testid={`consent-badge-${i}`}>
                            {patient.marketing_consent === 'do_not_contact' && <Ban className="h-3 w-3 mr-1" />}
                            {patient.marketing_consent === 'open' ? 'Open' :
                             patient.marketing_consent === 'moderate' ? 'Moderate' : 'DNC'}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-slate-500">
                        {patient.age ? `${patient.age} yrs` : ''}{patient.sex ? ` • ${patient.sex}` : ''}{patient.phone ? ` • ${patient.phone}` : ''}
                        {getLocationText(patient) ? ` • ${getLocationText(patient)}` : ''}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {patient.diseases?.slice(0, 3).map((disease, j) => (
                          <span key={j} className={`disease-badge ${getDiseaseColor(disease)}`}>
                            {disease}
                          </span>
                        ))}
                        {patient.diseases?.length > 3 && (
                          <span className="disease-badge bg-slate-100 text-slate-600">
                            +{patient.diseases.length - 3}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="hidden md:flex items-center gap-6 text-sm">
                      <div className="text-center">
                        <div className="flex items-center gap-1 text-slate-500">
                          <Pill className="h-4 w-4" />
                          <span className="font-medium text-slate-900">{patient.medicines?.length || 0}</span>
                        </div>
                        <p className="text-xs text-slate-400">Medicines</p>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center gap-1 text-slate-500">
                          <Activity className="h-4 w-4" />
                          <span className={`font-medium ${patient.adherence_rate < 70 ? 'text-red-500' : 'text-green-500'}`}>
                            {patient.adherence_rate}%
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">Adherence</p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Button
                        size="icon"
                        variant="outline"
                        className="call-btn h-10 w-10 rounded-full border-teal-200 text-teal-600 hover:bg-[#2BA89F]/10"
                        onClick={(e) => {
                          e.preventDefault();
                          window.location.href = `tel:${patient.phone}`;
                        }}
                        data-testid={`call-patient-${i}`}
                      >
                        <Phone className="h-4 w-4" />
                      </Button>
                      <ChevronRight className="h-5 w-5 text-slate-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
