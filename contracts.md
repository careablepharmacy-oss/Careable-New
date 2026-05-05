# DiabeXpert API Contracts

## Authentication Flow

### 1. Login with Google OAuth (Emergent)
**Frontend:**
- Redirect to: `https://auth.emergentagent.com/?redirect=${encodeURIComponent('http://localhost:3000/home')}`
- After OAuth, user lands at: `http://localhost:3000/home#session_id={session_id}`
- Extract session_id from URL fragment
- Call: `POST /api/auth/session` with body: `{session_id: "..."}`
- Store user data from response
- Clear URL fragment

**Backend API:**
```
POST /api/auth/session
Body: { session_id: string }
Response: { user: { id, email, name, picture, phone, diabetes_type } }
Sets httpOnly cookie: session_token
```

### 2. Check Authenticated User
```
GET /api/auth/me
Response: { id, email, name, picture, phone, diabetes_type }
```

### 3. Logout
```
POST /api/auth/logout
Response: { message: "Logged out successfully" }
Clears session_token cookie
```

## User Profile APIs

### Get User Profile
```
GET /api/users/me
Response: User object
```

### Update User Profile
```
PUT /api/users/me
Body: { name?, phone?, diabetes_type? }
Response: Updated user object
```

## Medication APIs

### Get All Medications
```
GET /api/medications
Response: Medication[]
```

### Create Medication
```
POST /api/medications
Body: {
  name: string,
  dosage: string,
  form: string,
  color: string,
  instructions: string,
  schedule: {
    frequency: 'daily' | 'weekly' | 'as-needed',
    times: string[],  // ['09:00', '21:00']
    start_date: string,
    end_date: string | null
  },
  refill_reminder: {
    enabled: boolean,
    pills_remaining: number,
    threshold: number
  }
}
Response: Medication object
```

### Update Medication
```
PUT /api/medications/{medication_id}
Body: Partial medication data
Response: Updated medication
```

### Delete Medication
```
DELETE /api/medications/{medication_id}
Response: { message: "Medication deleted successfully" }
```

## Adherence Log APIs

### Get Adherence Logs
```
GET /api/adherence?start_date=2025-01-01&end_date=2025-01-31
Response: AdherenceLog[]
```

### Create Adherence Log
```
POST /api/adherence
Body: {
  medication_id: string,
  scheduled_time: string,
  status: 'pending' | 'taken' | 'skipped',
  taken_time: string | null,
  date: string
}
Response: AdherenceLog object
```

### Update Adherence Log
```
PUT /api/adherence/{log_id}?status=taken&taken_time=09:05
Response: Updated log
```

## Health Metrics APIs

### Blood Glucose
```
GET /api/health/glucose?start_date=2025-01-01&end_date=2025-01-31
Response: BloodGlucose[]

POST /api/health/glucose
Body: {
  value: number,
  time: string,
  meal_context: string,
  date: string,
  notes: string | null
}
Response: BloodGlucose object
```

### Blood Pressure
```
GET /api/health/bp?start_date=2025-01-01&end_date=2025-01-31
Response: BloodPressure[]

POST /api/health/bp
Body: {
  systolic: number,
  diastolic: number,
  pulse: number | null,
  time: string,
  date: string,
  notes: string | null
}
Response: BloodPressure object
```

### Body Metrics (Weight, Height, BMI)
```
GET /api/health/metrics?start_date=2025-01-01&end_date=2025-01-31
Response: BodyMetrics[]

POST /api/health/metrics
Body: {
  weight: number,
  height: number,
  bmi: number,
  date: string,
  notes: string | null
}
Response: BodyMetrics object
```

## Appointment APIs

### Get Appointments
```
GET /api/appointments
Response: Appointment[]
```

### Create Appointment
```
POST /api/appointments
Body: {
  type: 'doctor' | 'lab',
  title: string,
  doctor: string | null,
  date: string,
  time: string,
  location: string | null,
  notes: string | null
}
Response: Appointment object
```

## Food & Exercise Log APIs

### Food Logs
```
GET /api/food-logs?date=2025-01-20
Response: FoodLog[]

POST /api/food-logs
Body: {
  date: string,
  time: string,
  meal: string,
  items: string,
  carbs: number | null,
  calories: number | null
}
Response: FoodLog object
```

### Exercise Logs
```
GET /api/exercise-logs?date=2025-01-20
Response: ExerciseLog[]

POST /api/exercise-logs
Body: {
  date: string,
  time: string,
  activity: string,
  duration: number,
  calories: number | null,
  notes: string | null
}
Response: ExerciseLog object
```

## Notification Settings APIs

### Get Notification Settings
```
GET /api/settings/notifications
Response: NotificationSettings object
```

### Update Notification Settings
```
PUT /api/settings/notifications
Body: {
  medication_reminders?: boolean,
  appointment_reminders?: boolean,
  health_tips?: boolean,
  email_notifications?: boolean,
  push_notifications?: boolean
}
Response: Updated settings
```

## Frontend Integration Plan

1. **Remove mock data** from components
2. **Create API service layer** (`/frontend/src/services/api.js`)
3. **Create AuthContext** for authentication state management
4. **Update LandingPage** to handle OAuth flow
5. **Update all data-fetching components** to use real APIs
6. **Add loading states** and error handling
7. **Update forms** to submit to backend APIs

## Authentication in Components

All API calls should include credentials (cookies):
```javascript
const response = await fetch(API_URL, {
  method: 'GET',
  credentials: 'include',  // Important for cookies
  headers: {
    'Content-Type': 'application/json'
  }
});
```

## Error Handling

- 401 Unauthorized → Redirect to login
- 404 Not Found → Show appropriate message
- 500 Server Error → Show error toast
