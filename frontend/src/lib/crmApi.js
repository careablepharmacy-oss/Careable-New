import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api/crm`;

// All CRM requests go through this axios instance.
// withCredentials=true ensures the Careable 360+ session cookie is sent so PM auth works.
const api = axios.create({
  baseURL: API,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// Dashboard
export const getDashboardStats = () => api.get('/dashboard/stats');
export const getPatientsToCall = () => api.get('/dashboard/patients-to-call');
export const getPatientsToCallGrouped = () => api.get('/dashboard/patients-to-call-grouped');
export const getPatientPendingTasks = (patientId) =>
  api.get(`/patients/${patientId}/pending-tasks`);
export const togglePatientTask = (patientId, payload) =>
  api.post(`/patients/${patientId}/tasks/toggle`, payload);
export const getRevenueSummary = (month) =>
  api.get('/dashboard/revenue-summary', { params: month ? { month } : {} });

// Reports
export const getLabReconciliation = (params) => api.get('/reports/lab-reconciliation', { params });
export const getLabReconciliationDetails = (params) =>
  api.get('/reports/lab-reconciliation/details', { params });

// Revenue conversions
export const recordRevenueConversion = (patientId, data) =>
  api.post(`/patients/${patientId}/revenue/convert`, data);
export const getPatientMtdRevenue = (patientId) =>
  api.get(`/patients/${patientId}/revenue/mtd`);
export const getPatientMonthlyInvoiceAmount = (patientId) =>
  api.get(`/patients/${patientId}/monthly-invoice-amount`);

// Patients
export const getPatients = (params) => api.get('/patients', { params });
export const getPatient = (id) => api.get(`/patients/${id}`);
export const createPatient = (data) => api.post('/patients', data);
export const updatePatient = (id, data) => api.put(`/patients/${id}`, data);
export const deletePatient = (id) => api.delete(`/patients/${id}`);

// Sync from main app (on-demand)
export const syncFromMainApp = () => api.post('/sync/from-main-app');

// Onboarding pending list (patients joined recently with empty onboarding fields)
export const getPendingOnboarding = (days = 30) => api.get('/onboarding/pending', { params: { days } });

// Medicine Intel (AI-powered disease detection + product suggestions, Gemini-backed, cached)
export const getDetectedDiseases = (patientId, warm = true) =>
  api.get(`/patients/${patientId}/detected-diseases`, { params: { warm } });
export const selectDetectedDiseases = (patientId, diseases) =>
  api.post(`/patients/${patientId}/detected-diseases/select`, { diseases });
export const deleteDetectedDisease = (patientId, diseaseName) =>
  api.delete(`/patients/${patientId}/detected-diseases/${encodeURIComponent(diseaseName)}`);
export const restoreDetectedDisease = (patientId, diseaseName) =>
  api.post(`/patients/${patientId}/detected-diseases/${encodeURIComponent(diseaseName)}/restore`);
export const warmMedicineIntel = (medicines) => api.post('/medicine-intel/warm', { medicines });

// Deprecated sync stubs (kept to preserve page imports). These now call the unified sync.
export const syncPatient = () => api.post('/sync/from-main-app');
export const syncMedications = () => api.post('/sync/from-main-app');
export const syncVitals = () => api.post('/sync/from-main-app');
export const getSyncStatus = () => Promise.resolve({ data: { total_patients: 0, synced: 0, sync_logs: [] } });
export const getPatientSyncStatus = () => Promise.resolve({ data: { encare_user_id: null, last_synced_at: null, sync_source: null } });
export const listEncarePatientsForSync = () => Promise.resolve({ data: [] });
export const seedDatabase = () => api.post('/sync/from-main-app');

// Vitals (unified endpoint)
export const addVital = (patientId, data) => api.post(`/patients/${patientId}/vitals`, data);
export const getVitals = (patientId, days = 30) =>
  api.get(`/patients/${patientId}/vitals`, { params: { days } });

// Interactions
export const addInteraction = (patientId, data) =>
  api.post(`/patients/${patientId}/interactions`, data);
export const getInteractions = (patientId) => api.get(`/patients/${patientId}/interactions`);

// Lab Tests
export const bookLabTest = (patientId, data) =>
  api.post(`/patients/${patientId}/lab-tests/book`, data);
export const getLabTests = (patientId) => api.get(`/patients/${patientId}/lab-tests`);
export const updateLabTest = (patientId, testId, data) =>
  api.put(`/patients/${patientId}/lab-tests/${testId}`, data);

// Medicines
export const addMedicine = (patientId, data) =>
  api.post(`/patients/${patientId}/medicines`, data);
export const updateMedicine = (patientId, medicineId, data) =>
  api.put(`/patients/${patientId}/medicines/${medicineId}`, data);
export const deleteMedicine = (patientId, medicineId) =>
  api.delete(`/patients/${patientId}/medicines/${medicineId}`);
export const refillMedicine = (patientId, medicineIndex, quantity) =>
  api.put(`/patients/${patientId}/medicines/${medicineIndex}/refill?quantity=${quantity}`);

// Suggestions
export const getProductSuggestions = (patientId) =>
  api.get(`/patients/${patientId}/suggestions/products`);
export const getLabTestSuggestions = (patientId) =>
  api.get(`/patients/${patientId}/suggestions/lab-tests`);

// Opportunities
export const getOpportunities = (params) => api.get('/opportunities', { params });
export const generateOpportunities = () => api.post('/opportunities/generate');
export const updateOpportunity = (id, data) => api.put(`/opportunities/${id}`, data);

// Catalogs
export const getProductCatalog = () => api.get('/catalog/products');
export const getLabTestCatalog = () => api.get('/catalog/lab-tests');
export const addCustomLabTest = (data) => api.post('/catalog/lab-tests', data);
export const updateLabTestPrice = (testName, price) =>
  api.put(`/catalog/lab-tests/${encodeURIComponent(testName)}/price`, { price });
export const updateCustomLabTest = (testId, data) =>
  api.put(`/catalog/lab-tests/${testId}`, data);
export const deleteCustomLabTest = (testId) => api.delete(`/catalog/lab-tests/${testId}`);

// Laboratories
export const getLaboratories = () => api.get('/laboratories');
export const addLaboratory = (data) => api.post('/laboratories', data);
export const updateLaboratory = (labId, data) => api.put(`/laboratories/${labId}`, data);
export const deleteLaboratory = (labId) => api.delete(`/laboratories/${labId}`);

// Medicine Analysis
export const analyzeMedicine = (medicineName) =>
  api.post(`/medicine/analyze?medicine_name=${encodeURIComponent(medicineName)}`);

// Doctor Appointments
export const createDoctorAppointment = (patientId, data) =>
  api.post(`/patients/${patientId}/appointments`, data);
export const getDoctorAppointments = (patientId) =>
  api.get(`/patients/${patientId}/appointments`);
export const updateAppointmentStatus = (patientId, appointmentId, status) =>
  api.put(`/patients/${patientId}/appointments/${appointmentId}/status`, { status });
export const deleteDoctorAppointment = (patientId, appointmentId) =>
  api.delete(`/patients/${patientId}/appointments/${appointmentId}`);

// Onboarding Profile
export const getOnboardingProfile = (patientId) =>
  api.get(`/patients/${patientId}/onboarding`);
export const updateOnboardingProfile = (patientId, data) =>
  api.put(`/patients/${patientId}/onboarding`, data);

// Invoices & Orders (consolidated view for Patient Profile tab)
export const getPatientInvoicesAndOrders = (patientId) =>
  api.get(`/patients/${patientId}/invoices`);

export default api;
