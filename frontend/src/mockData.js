// Mock data for DiabeXpert - Diabetes Management App

export const mockUser = {
  id: '1',
  name: 'John Doe',
  email: 'john@example.com',
  avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=John',
  diabetesType: 'Type 2'
};

export const mockMedications = [
  {
    id: '1',
    name: 'Metformin',
    dosage: '500mg',
    form: 'Tablet',
    color: '#FF6B6B',
    icon: 'pill',
    instructions: 'Take with food',
    schedule: {
      frequency: 'daily',
      times: ['09:00', '21:00'],
      startDate: '2025-01-01',
      endDate: null
    },
    refillReminder: {
      enabled: true,
      pillsRemaining: 15,
      threshold: 7
    }
  },
  {
    id: '2',
    name: 'Insulin Glargine',
    dosage: '20 units',
    form: 'Injection',
    color: '#4ECDC4',
    icon: 'syringe',
    instructions: 'Inject before bedtime',
    schedule: {
      frequency: 'daily',
      times: ['22:00'],
      startDate: '2025-01-01',
      endDate: null
    },
    refillReminder: {
      enabled: true,
      pillsRemaining: 5,
      threshold: 3
    }
  },
  {
    id: '3',
    name: 'Vitamin D',
    dosage: '1000 IU',
    form: 'Capsule',
    color: '#FFD93D',
    icon: 'capsule',
    instructions: 'Take in the morning',
    schedule: {
      frequency: 'daily',
      times: ['08:00'],
      startDate: '2025-01-01',
      endDate: null
    },
    refillReminder: {
      enabled: true,
      pillsRemaining: 30,
      threshold: 7
    }
  }
];

export const mockAppointments = [
  {
    id: '1',
    type: 'doctor',
    title: 'Endocrinologist Visit',
    doctor: 'Dr. Sarah Smith',
    date: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
    time: '10:30',
    location: 'City Diabetes Center',
    notes: 'Review blood sugar levels',
    status: 'upcoming'
  },
  {
    id: '2',
    type: 'lab',
    title: 'HbA1c Test',
    date: new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0],
    time: '08:00',
    location: 'Central Lab',
    notes: 'Fasting required',
    status: 'upcoming'
  }
];

export const mockFoodLog = [
  {
    id: '1',
    date: new Date().toISOString().split('T')[0],
    time: '08:30',
    meal: 'Breakfast',
    items: 'Oatmeal with berries, black coffee',
    carbs: 45,
    calories: 280
  },
  {
    id: '2',
    date: new Date().toISOString().split('T')[0],
    time: '13:00',
    meal: 'Lunch',
    items: 'Grilled chicken salad, whole wheat bread',
    carbs: 35,
    calories: 420
  }
];

export const mockExerciseLog = [
  {
    id: '1',
    date: new Date().toISOString().split('T')[0],
    time: '07:00',
    activity: 'Morning Walk',
    duration: 30,
    calories: 150,
    notes: 'Park trail'
  },
  {
    id: '2',
    date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
    time: '18:00',
    activity: 'Yoga',
    duration: 45,
    calories: 180,
    notes: 'Evening session'
  }
];

export const mockAdherenceLog = [
  // Today
  { id: '1', medicationId: '1', scheduledTime: '09:00', takenTime: '09:05', status: 'taken', date: new Date().toISOString().split('T')[0] },
  { id: '2', medicationId: '3', scheduledTime: '08:00', takenTime: '08:10', status: 'taken', date: new Date().toISOString().split('T')[0] },
  { id: '3', medicationId: '1', scheduledTime: '21:00', takenTime: null, status: 'pending', date: new Date().toISOString().split('T')[0] },
  { id: '4', medicationId: '2', scheduledTime: '22:00', takenTime: null, status: 'pending', date: new Date().toISOString().split('T')[0] },
  
  // Yesterday
  { id: '5', medicationId: '1', scheduledTime: '09:00', takenTime: '09:15', status: 'taken', date: new Date(Date.now() - 86400000).toISOString().split('T')[0] },
  { id: '6', medicationId: '3', scheduledTime: '08:00', takenTime: '08:05', status: 'taken', date: new Date(Date.now() - 86400000).toISOString().split('T')[0] },
  { id: '7', medicationId: '1', scheduledTime: '21:00', takenTime: null, status: 'skipped', date: new Date(Date.now() - 86400000).toISOString().split('T')[0] },
  { id: '8', medicationId: '2', scheduledTime: '22:00', takenTime: '22:30', status: 'taken', date: new Date(Date.now() - 86400000).toISOString().split('T')[0] }
];

export const mockBloodGlucose = [
  { id: '1', value: 95, unit: 'mg/dL', time: '08:00', mealContext: 'Fasting', date: new Date().toISOString().split('T')[0] },
  { id: '2', value: 145, unit: 'mg/dL', time: '14:00', mealContext: 'After Lunch', date: new Date().toISOString().split('T')[0] },
  { id: '3', value: 88, unit: 'mg/dL', time: '08:00', mealContext: 'Fasting', date: new Date(Date.now() - 86400000).toISOString().split('T')[0] },
  { id: '4', value: 152, unit: 'mg/dL', time: '14:00', mealContext: 'After Lunch', date: new Date(Date.now() - 86400000).toISOString().split('T')[0] },
  { id: '5', value: 92, unit: 'mg/dL', time: '08:00', mealContext: 'Fasting', date: new Date(Date.now() - 172800000).toISOString().split('T')[0] },
  { id: '6', value: 138, unit: 'mg/dL', time: '14:00', mealContext: 'After Lunch', date: new Date(Date.now() - 172800000).toISOString().split('T')[0] },
  { id: '7', value: 90, unit: 'mg/dL', time: '08:00', mealContext: 'Fasting', date: new Date(Date.now() - 259200000).toISOString().split('T')[0] },
  { id: '8', value: 142, unit: 'mg/dL', time: '14:00', mealContext: 'After Lunch', date: new Date(Date.now() - 259200000).toISOString().split('T')[0] }
];

export const mockBloodPressure = [
  { id: '1', systolic: 120, diastolic: 80, pulse: 72, time: '09:00', date: new Date().toISOString().split('T')[0] },
  { id: '2', systolic: 118, diastolic: 78, pulse: 70, time: '09:00', date: new Date(Date.now() - 86400000).toISOString().split('T')[0] },
  { id: '3', systolic: 122, diastolic: 82, pulse: 74, time: '09:00', date: new Date(Date.now() - 172800000).toISOString().split('T')[0] },
  { id: '4', systolic: 119, diastolic: 79, pulse: 71, time: '09:00', date: new Date(Date.now() - 259200000).toISOString().split('T')[0] }
];

export const mockBodyMetrics = [
  { id: '1', weight: 75, height: 170, bmi: 25.9, date: new Date().toISOString().split('T')[0] },
  { id: '2', weight: 75.5, height: 170, bmi: 26.1, date: new Date(Date.now() - 604800000).toISOString().split('T')[0] },
  { id: '3', weight: 76, height: 170, bmi: 26.3, date: new Date(Date.now() - 1209600000).toISOString().split('T')[0] },
  { id: '4', weight: 76.5, height: 170, bmi: 26.5, date: new Date(Date.now() - 1814400000).toISOString().split('T')[0] }
];
