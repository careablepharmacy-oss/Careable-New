import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  FlaskConical,
  Search,
  RefreshCw,
  IndianRupee,
  Clock,
  Info,
  Plus,
  Pencil,
  Trash2,
  MapPin,
  Phone,
  Building2,
  Check,
  X,
  Mail
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getLabTestCatalog,
  addCustomLabTest,
  updateLabTestPrice,
  updateCustomLabTest,
  deleteCustomLabTest,
  getLaboratories,
  addLaboratory,
  updateLaboratory,
  deleteLaboratory
} from "@/lib/crmApi";

const DISEASES = [
  "Diabetes", "Hypertension", "Heart Disease", "Thyroid",
  "Arthritis", "Elderly Care", "Respiratory"
];

export default function LabTests() {
  const [catalog, setCatalog] = useState([]);
  const [laboratories, setLaboratories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Lab test dialog state
  const [showTestDialog, setShowTestDialog] = useState(false);
  const [editingTest, setEditingTest] = useState(null);
  const [testForm, setTestForm] = useState({ name: "", diseases: [], frequency_months: "6", price: "" });
  const [diseaseInput, setDiseaseInput] = useState("");

  // Price editing inline
  const [editingPrice, setEditingPrice] = useState(null);
  const [priceValue, setPriceValue] = useState("");

  // Lab dialog state
  const [showLabDialog, setShowLabDialog] = useState(false);
  const [editingLab, setEditingLab] = useState(null);
  const [labForm, setLabForm] = useState({ name: "", address: "", city: "", state: "", pincode: "", phone: "", email: "", notes: "" });

  const fetchData = async () => {
    try {
      const [testsRes, labsRes] = await Promise.all([
        getLabTestCatalog(),
        getLaboratories()
      ]);
      setCatalog(testsRes.data);
      setLaboratories(labsRes.data);
    } catch (error) {
      toast.error("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // ---- Lab test handlers ----
  const resetTestForm = () => {
    setTestForm({ name: "", diseases: [], frequency_months: "6", price: "" });
    setDiseaseInput("");
    setEditingTest(null);
  };

  const openAddTest = () => { resetTestForm(); setShowTestDialog(true); };

  const openEditTest = (test) => {
    setTestForm({
      name: test.name,
      diseases: test.diseases || [],
      frequency_months: String(test.frequency_months || 6),
      price: String(test.price || 0)
    });
    setEditingTest(test);
    setShowTestDialog(true);
  };

  const handleSaveTest = async () => {
    if (!testForm.name.trim()) { toast.error("Test name is required"); return; }
    try {
      // Flush any pending disease input before saving
      const finalDiseases = [...testForm.diseases];
      const pending = diseaseInput.trim();
      if (pending && !finalDiseases.includes(pending)) {
        finalDiseases.push(pending);
      }

      const payload = {
        name: testForm.name,
        diseases: finalDiseases,
        frequency_months: parseInt(testForm.frequency_months) || 6,
        price: parseFloat(testForm.price) || 0
      };
      if (editingTest && editingTest.source === "custom" && editingTest.id) {
        await updateCustomLabTest(editingTest.id, payload);
        toast.success("Lab test updated!");
      } else {
        await addCustomLabTest(payload);
        toast.success("Lab test added!");
      }
      setShowTestDialog(false);
      resetTestForm();
      fetchData();
    } catch (error) {
      toast.error("Failed to save lab test");
    }
  };

  const handleDeleteTest = async (test) => {
    if (!test.id || test.source !== "custom") { toast.error("Built-in tests cannot be deleted"); return; }
    if (!window.confirm(`Delete "${test.name}" from catalog?`)) return;
    try {
      await deleteCustomLabTest(test.id);
      toast.success("Lab test removed");
      fetchData();
    } catch (error) {
      toast.error("Failed to delete lab test");
    }
  };

  const startEditPrice = (test) => {
    setEditingPrice(test.name);
    setPriceValue(String(test.price || 0));
  };

  const savePrice = async (testName) => {
    try {
      await updateLabTestPrice(testName, parseFloat(priceValue) || 0);
      toast.success("Price updated!");
      setEditingPrice(null);
      fetchData();
    } catch (error) {
      toast.error("Failed to update price");
    }
  };

  const addDiseaseTag = (value) => {
    const d = (value !== undefined ? value : diseaseInput).trim();
    if (d && !testForm.diseases.includes(d)) {
      setTestForm(prev => ({ ...prev, diseases: [...prev.diseases, d] }));
    }
    setDiseaseInput("");
  };

  const handleDiseaseInputChange = (e) => {
    const val = e.target.value;
    setDiseaseInput(val);
    // Auto-add if user selected a value from the datalist
    if (DISEASES.includes(val) && !testForm.diseases.includes(val)) {
      setTestForm(prev => ({ ...prev, diseases: [...prev.diseases, val] }));
      setDiseaseInput("");
    }
  };

  const removeDiseaseTag = (d) => {
    setTestForm(prev => ({ ...prev, diseases: prev.diseases.filter(x => x !== d) }));
  };

  // ---- Laboratory handlers ----
  const resetLabForm = () => {
    setLabForm({ name: "", address: "", city: "", state: "", pincode: "", phone: "", email: "", notes: "" });
    setEditingLab(null);
  };

  const openAddLab = () => { resetLabForm(); setShowLabDialog(true); };

  const openEditLab = (lab) => {
    setLabForm({
      name: lab.name || "",
      address: lab.address || "",
      city: lab.city || "",
      state: lab.state || "",
      pincode: lab.pincode || "",
      phone: lab.phone || "",
      email: lab.email || "",
      notes: lab.notes || ""
    });
    setEditingLab(lab);
    setShowLabDialog(true);
  };

  const handleSaveLab = async () => {
    if (!labForm.name.trim()) { toast.error("Laboratory name is required"); return; }
    try {
      if (editingLab) {
        await updateLaboratory(editingLab.id, labForm);
        toast.success("Laboratory updated!");
      } else {
        await addLaboratory(labForm);
        toast.success("Laboratory added!");
      }
      setShowLabDialog(false);
      resetLabForm();
      fetchData();
    } catch (error) {
      toast.error("Failed to save laboratory");
    }
  };

  const handleDeleteLab = async (lab) => {
    if (!window.confirm(`Delete "${lab.name}"?`)) return;
    try {
      await deleteLaboratory(lab.id);
      toast.success("Laboratory removed");
      fetchData();
    } catch (error) {
      toast.error("Failed to delete laboratory");
    }
  };

  // ---- Filtering & grouping ----
  const filteredCatalog = catalog.filter(test =>
    test.name.toLowerCase().includes(search.toLowerCase()) ||
    test.diseases?.some(d => d.toLowerCase().includes(search.toLowerCase()))
  );

  const diseaseGroups = filteredCatalog.reduce((acc, test) => {
    test.diseases?.forEach(disease => {
      if (!acc[disease]) acc[disease] = [];
      if (!acc[disease].find(t => t.name === test.name)) acc[disease].push(test);
    });
    return acc;
  }, {});

  const getDiseaseColor = (disease) => {
    const colors = {
      "Diabetes": "bg-purple-100 text-purple-700 border-purple-200",
      "Hypertension": "bg-red-100 text-red-700 border-red-200",
      "Heart Disease": "bg-pink-100 text-pink-700 border-pink-200",
      "Thyroid": "bg-blue-100 text-blue-700 border-blue-200",
      "Arthritis": "bg-orange-100 text-orange-700 border-orange-200",
      "Elderly Care": "bg-green-100 text-green-700 border-green-200",
      "Respiratory": "bg-teal-100 text-teal-700 border-teal-200"
    };
    return colors[disease] || "bg-slate-100 text-slate-700 border-slate-200";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="lab-tests-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Lab Test Catalog</h1>
          <p className="text-slate-500 text-sm">{catalog.length} tests available • {laboratories.length} laboratories</p>
        </div>
      </div>

      {/* Info Banner */}
      <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-100">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-purple-500 mt-0.5" />
            <div>
              <p className="font-medium text-slate-900">Lab Test Recommendations</p>
              <p className="text-sm text-slate-600 mt-1">
                Tests are recommended based on patient health conditions. You can also add custom tests and manage laboratory partners.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tests or conditions..."
              className="pl-10"
              data-testid="lab-test-search"
            />
          </div>
        </CardContent>
      </Card>

      {/* Tabs: Tests by Condition | All Lab Tests | Laboratories */}
      <Tabs defaultValue="by-condition" className="space-y-4">
        <TabsList className="bg-slate-100 p-1">
          <TabsTrigger value="by-condition" data-testid="by-condition-tab">
            <FlaskConical className="h-4 w-4 mr-2" />
            By Condition
          </TabsTrigger>
          <TabsTrigger value="all-tests" data-testid="all-tests-tab">
            <FlaskConical className="h-4 w-4 mr-2" />
            All Lab Tests
          </TabsTrigger>
          <TabsTrigger value="laboratories" data-testid="laboratories-tab">
            <Building2 className="h-4 w-4 mr-2" />
            Laboratories
          </TabsTrigger>
        </TabsList>

        {/* By Condition Tab */}
        <TabsContent value="by-condition">
          <Card data-testid="lab-tests-catalog">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Tests by Health Condition</CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" className="space-y-2">
                {Object.entries(diseaseGroups).map(([disease, tests], i) => (
                  <AccordionItem key={disease} value={disease} className="border rounded-lg px-4">
                    <AccordionTrigger className="hover:no-underline py-4" data-testid={`disease-accordion-${i}`}>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className={getDiseaseColor(disease)}>
                          {disease}
                        </Badge>
                        <span className="text-sm text-slate-500">{tests.length} tests</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3 pb-4">
                        {tests.map((test, j) => (
                          <div
                            key={j}
                            className="flex items-center justify-between p-4 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
                            data-testid={`lab-test-item-${i}-${j}`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-purple-100 text-purple-500">
                                <FlaskConical className="h-5 w-5" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-medium text-slate-900">{test.name}</p>
                                  {test.source === "custom" && (
                                    <Badge variant="outline" className="text-xs bg-teal-50 text-teal-700 border-teal-200">Custom</Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    Every {test.frequency_months} months
                                  </span>
                                </div>
                              </div>
                            </div>
                            <p className="font-semibold text-purple-600 flex items-center gap-1">
                              <IndianRupee className="h-4 w-4" />
                              {test.price?.toLocaleString('en-IN')}
                            </p>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>

        {/* All Lab Tests Tab */}
        <TabsContent value="all-tests">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold">All Lab Tests</CardTitle>
                <Button className="gradient-teal text-white" onClick={openAddTest} data-testid="add-lab-test-btn">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Lab Test
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-3 px-4 font-medium text-slate-500">Test Name</th>
                      <th className="text-left py-3 px-4 font-medium text-slate-500">Conditions</th>
                      <th className="text-left py-3 px-4 font-medium text-slate-500">Frequency</th>
                      <th className="text-right py-3 px-4 font-medium text-slate-500">Price (₹)</th>
                      <th className="text-right py-3 px-4 font-medium text-slate-500 w-32">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCatalog.map((test, i) => (
                      <tr key={test.id || test.name} className="border-b border-slate-50 hover:bg-slate-50 transition-colors" data-testid={`lab-test-row-${i}`}>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <FlaskConical className="h-4 w-4 text-purple-500" />
                            <span className="font-medium text-slate-900">{test.name}</span>
                            {test.source === "custom" && (
                              <Badge variant="outline" className="text-xs bg-teal-50 text-teal-700 border-teal-200">Custom</Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1">
                            {test.diseases?.map((d, j) => (
                              <Badge key={j} variant="outline" className="text-xs">{d}</Badge>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          Every {test.frequency_months} months
                        </td>
                        <td className="py-3 px-4 text-right">
                          {editingPrice === test.name ? (
                            <div className="flex items-center justify-end gap-1">
                              <Input
                                type="number"
                                value={priceValue}
                                onChange={(e) => setPriceValue(e.target.value)}
                                className="w-24 h-8 text-right text-sm"
                                min="0"
                                autoFocus
                                data-testid={`price-input-${i}`}
                                onKeyDown={(e) => { if (e.key === 'Enter') savePrice(test.name); if (e.key === 'Escape') setEditingPrice(null); }}
                              />
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" onClick={() => savePrice(test.name)} data-testid={`price-save-${i}`}>
                                <Check className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400" onClick={() => setEditingPrice(null)}>
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <span
                              className="font-medium text-purple-600 tabular-nums cursor-pointer hover:underline"
                              onClick={() => startEditPrice(test)}
                              data-testid={`price-display-${i}`}
                              title="Click to edit price"
                            >
                              ₹{test.price?.toLocaleString('en-IN')}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500 hover:text-teal-600" onClick={() => startEditPrice(test)} data-testid={`edit-price-${i}`} title="Edit price">
                              <IndianRupee className="h-3.5 w-3.5" />
                            </Button>
                            {test.source === "custom" && (
                              <>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500 hover:text-blue-600" onClick={() => openEditTest(test)} data-testid={`edit-test-${i}`} title="Edit test">
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500 hover:text-red-600" onClick={() => handleDeleteTest(test)} data-testid={`delete-test-${i}`} title="Delete test">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredCatalog.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-500">No lab tests found</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Laboratories Tab */}
        <TabsContent value="laboratories">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold">Partner Laboratories</CardTitle>
                <Button className="gradient-teal text-white" onClick={openAddLab} data-testid="add-laboratory-btn">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Laboratory
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {laboratories.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Building2 className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                  <p>No laboratories added yet</p>
                  <p className="text-sm mt-1">Add partner labs to refer patients for tests</p>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {laboratories.map((lab, i) => (
                    <div
                      key={lab.id}
                      className="p-4 rounded-lg border border-slate-100 bg-slate-50 hover:shadow-md transition-shadow"
                      data-testid={`laboratory-card-${i}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="p-2.5 rounded-lg bg-blue-100 text-blue-600">
                            <Building2 className="h-5 w-5" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-slate-900">{lab.name}</h4>
                            {(lab.address || lab.city) && (
                              <p className="text-sm text-slate-500 flex items-center gap-1 mt-1">
                                <MapPin className="h-3 w-3" />
                                {[lab.address, lab.city, lab.state, lab.pincode].filter(Boolean).join(", ")}
                              </p>
                            )}
                            {lab.phone && (
                              <p className="text-sm text-slate-500 flex items-center gap-1 mt-1">
                                <Phone className="h-3 w-3" />
                                {lab.phone}
                              </p>
                            )}
                            {lab.email && (
                              <p className="text-sm text-slate-500 flex items-center gap-1 mt-1">
                                <Mail className="h-3 w-3" />
                                {lab.email}
                              </p>
                            )}
                            {lab.notes && (
                              <p className="text-xs text-slate-400 mt-2 italic">{lab.notes}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500 hover:text-blue-600" onClick={() => openEditLab(lab)} data-testid={`edit-lab-${i}`}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500 hover:text-red-600" onClick={() => handleDeleteLab(lab)} data-testid={`delete-lab-${i}`}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add/Edit Lab Test Dialog */}
      <Dialog open={showTestDialog} onOpenChange={(open) => { if (!open) resetTestForm(); setShowTestDialog(open); }}>
        <DialogContent className="max-w-md" data-testid="lab-test-dialog">
          <DialogHeader>
            <DialogTitle>{editingTest ? 'Edit Lab Test' : 'Add Lab Test'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Test Name *</Label>
              <Input
                value={testForm.name}
                onChange={(e) => setTestForm({ ...testForm, name: e.target.value })}
                placeholder="e.g. Vitamin B12"
                data-testid="test-name-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Health Conditions</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    value={diseaseInput}
                    onChange={handleDiseaseInputChange}
                    placeholder="Type or select condition"
                    data-testid="test-disease-input"
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addDiseaseTag(); } }}
                    onBlur={() => { if (diseaseInput.trim()) addDiseaseTag(); }}
                    list="disease-suggestions"
                  />
                  <datalist id="disease-suggestions">
                    {DISEASES.filter(d => !testForm.diseases.includes(d)).map(d => (
                      <option key={d} value={d} />
                    ))}
                  </datalist>
                </div>
                <Button type="button" variant="outline" onClick={() => addDiseaseTag()} data-testid="add-disease-btn">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {testForm.diseases.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {testForm.diseases.map((d, i) => (
                    <Badge key={i} variant="outline" className="gap-1 pr-1">
                      {d}
                      <button type="button" onClick={() => removeDiseaseTag(d)} className="ml-1 hover:text-red-500">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Frequency (months)</Label>
                <Input
                  type="number"
                  value={testForm.frequency_months}
                  onChange={(e) => setTestForm({ ...testForm, frequency_months: e.target.value })}
                  placeholder="6"
                  min="1"
                  data-testid="test-frequency-input"
                />
              </div>
              <div className="space-y-2">
                <Label>Price (₹)</Label>
                <Input
                  type="number"
                  value={testForm.price}
                  onChange={(e) => setTestForm({ ...testForm, price: e.target.value })}
                  placeholder="0"
                  min="0"
                  data-testid="test-price-input"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowTestDialog(false); resetTestForm(); }}>Cancel</Button>
            <Button onClick={handleSaveTest} className="gradient-teal text-white" data-testid="save-lab-test-btn">
              {editingTest ? 'Update Test' : 'Add Test'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Laboratory Dialog */}
      <Dialog open={showLabDialog} onOpenChange={(open) => { if (!open) resetLabForm(); setShowLabDialog(open); }}>
        <DialogContent className="max-w-md" data-testid="laboratory-dialog">
          <DialogHeader>
            <DialogTitle>{editingLab ? 'Edit Laboratory' : 'Add Laboratory'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Laboratory Name *</Label>
              <Input
                value={labForm.name}
                onChange={(e) => setLabForm({ ...labForm, name: e.target.value })}
                placeholder="e.g. Apollo Diagnostics"
                data-testid="lab-name-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input
                value={labForm.address}
                onChange={(e) => setLabForm({ ...labForm, address: e.target.value })}
                placeholder="Street address"
                data-testid="lab-address-input"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>City</Label>
                <Input
                  value={labForm.city}
                  onChange={(e) => setLabForm({ ...labForm, city: e.target.value })}
                  placeholder="City"
                  data-testid="lab-city-input"
                />
              </div>
              <div className="space-y-2">
                <Label>State</Label>
                <Input
                  value={labForm.state}
                  onChange={(e) => setLabForm({ ...labForm, state: e.target.value })}
                  placeholder="State"
                  data-testid="lab-state-input"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Pincode</Label>
                <Input
                  value={labForm.pincode}
                  onChange={(e) => setLabForm({ ...labForm, pincode: e.target.value })}
                  placeholder="560001"
                  data-testid="lab-pincode-input"
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={labForm.phone}
                  onChange={(e) => setLabForm({ ...labForm, phone: e.target.value })}
                  placeholder="+91 XXXXX XXXXX"
                  data-testid="lab-phone-input"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email (Optional)</Label>
              <Input
                type="email"
                value={labForm.email}
                onChange={(e) => setLabForm({ ...labForm, email: e.target.value })}
                placeholder="lab@example.com"
                data-testid="lab-email-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Textarea
                value={labForm.notes}
                onChange={(e) => setLabForm({ ...labForm, notes: e.target.value })}
                placeholder="e.g. Open 24x7, home collection available"
                rows={2}
                data-testid="lab-notes-input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowLabDialog(false); resetLabForm(); }}>Cancel</Button>
            <Button onClick={handleSaveLab} className="gradient-teal text-white" data-testid="save-laboratory-btn">
              {editingLab ? 'Update Laboratory' : 'Add Laboratory'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
