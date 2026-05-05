# PRD — Careable 360+plus (rebranded reproduction of enCARE)

## Original Problem Statement
> User uploaded a public GitHub repo (https://github.com/diabexpertonline-max/encare_final-lap-version-1) of an existing healthcare PWA originally branded "enCARE". User wanted to reproduce the project as-is on a new Emergent preview URL with a fresh empty MongoDB, mocked data, full rebrand to "Careable 360+plus", and a new Android package name `com.careable360plus.app`.

## User Decisions Locked-In
- Source of truth: `main @ d3bf196` (May 4, 2026)
- Mongo: local pod (`mongodb://localhost:27017`), DB `careable360_db`, fresh empty
- LLM: Emergent LLM key (Gemini 2.5 Flash for medicine intel)
- Razorpay / SMTP / WhatsApp / OneSignal / Firebase keys: to be provided later (no-op until then)
- Android keystore: debug
- Android package: `com.diabexpert.app` → `com.careable360plus.app`
- Domain: new Emergent preview URL
- Mock data: minimal (2 users, 5 meds, 3 products, 2 invoices, 2 orders, 1 CRM profile, 1 revenue entry, 1 purchase-links)

## Architecture (unchanged from original repo)
- **Frontend**: React 19 + Tailwind + craco + Capacitor 7 (Android wrapper)
- **Backend**: FastAPI + Motor (async Mongo) + APScheduler
- **DB**: MongoDB
- **Auth**: Emergent-managed Google OAuth (`https://auth.emergentagent.com`)
- **Integrations**: OneSignal (push), Razorpay (payments), Gemini 2.5 Flash (medicine AI), SMTP (invoice email), WhatsApp webhook (missed-med family alert)

## What's Implemented (May 4, 2026)
- ✅ Repo cloned at `d3bf196` and dropped into `/app` (preserving platform `.git`/`.emergent`)
- ✅ Backend deps installed (`pip install --no-deps -r requirements.txt`)
- ✅ Frontend deps installed (`yarn install`)
- ✅ `backend/.env` and `frontend/.env` populated; Emergent LLM key wired in
- ✅ Local MongoDB seeded via `/app/backend/seed_mock_data.py`
- ✅ FastAPI server running on `:8001`; APScheduler started with all 4 jobs
- ✅ React dev server running on `:3000` via supervisor
- ✅ Full rebrand applied:
  - All user-visible "enCARE" → "Careable 360+plus" across frontend & backend (zero remnants)
  - PWA `manifest.json` (name, theme color #2BA89F, background #F8FAFB)
  - HTML `<title>` and meta description
  - Capacitor `appId`/`appName`
  - Android `strings.xml`, AndroidManifest.xml (deep link scheme `careable360plus://`), build.gradle namespace + applicationId, Java package directory & all `package` declarations renamed
  - `google-services.json` `package_name` field updated (project_id still old — needs new Firebase project file from user)
  - Tailwind config + CSS variables migrated to brand palette: navy `#1E3A5F`, teal `#2BA89F`, green `#7AB648`, gold `#E8A93C`
  - Hardcoded `#209C7E` / `#10b981` colors replaced
  - Logo image assets regenerated (`logo192.png`, `logo512.png`, `favicon.ico`, `careable-nametag.png`, `careable-icon.png`, plus the legacy `encare-logo.png`/`encare-name-tag.png` filenames overwritten with new content)
  - Landing page redesigned with logo emblem in white card + brand-color gradient background + styled "Careable 360⁺plus" wordmark
  - `auth.py determine_user_role()`: `careable360plus@gmail.com` → `prescription_manager`
  - `helpers.py ADMIN_EMAIL` → `careable360plus@gmail.com`
- ✅ Backend testing agent: 19/19 tests passed (health, scheduler, public endpoints, 401 auth-guard, seed presence, rebrand correctness)

## Test Credentials
See `/app/memory/test_credentials.md`. Login is Google OAuth; role auto-assigned by email match.

## Backlog / Not Yet Done (P1)
- [ ] User to provide real **OneSignal App ID + REST API Key** → `backend/.env` (`ONESIGNAL_APP_ID`, `ONESIGNAL_API_KEY`) and `frontend/.env` (`REACT_APP_ONESIGNAL_APP_ID`)
- [ ] User to provide real **Firebase project**: web config (frontend), service account JSON (backend), and **new `google-services.json`** for Android (must use package `com.careable360plus.app`)
- [ ] User to provide real **Razorpay** keys when ready (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`)
- [ ] User to provide **SMTP** creds for invoice-email delivery (`SMTP_EMAIL`, `SMTP_PASSWORD`)
- [ ] User to update **OAuth redirect URIs / authorized domains** in Google/Firebase console for new Emergent preview URL
- [ ] APK build: requires Android SDK + Gradle in pod; `cd /app/frontend && yarn cap:build && cd android && ./gradlew assembleDebug`

## Backlog (P2 / Optional)
- [ ] Update stale `diabexpertonline@gmail.com` references in 3 non-runtime utility scripts (`backend/cleanup_database.py`, `check_user_role.py`, `test_role_update.py`)
- [ ] CRM legacy DB field `encare_user_id` could be migrated to `careable_user_id`
- [ ] Old test files still contain `test@encare.com` literals — test-only, not shipped

## Known Limitations
- **Auth is Google-OAuth-only**: end-to-end UI testing of authenticated flows requires a live Google session
- **Push notifications, AI medicine intel, payment flow, invoice email** all gracefully no-op until corresponding keys are provided
- **Android APK build environment**: code is rebranded and ready, but Gradle/Android SDK must be installed in pod before building

---

## Session: JWT Auth + Splash Slideshow Refinement (May 5, 2026)

### Changes
- **New splash slideshow** (`/app/frontend/src/pages/LandingPage.jsx`):
  - 5 full-bleed image slides at `/public/splash/slide_{1-5}.jpg` (~150 KB each)
  - Full-screen images (square edges, no rounded corners)
  - Bottom CTA panel on every slide with "Continue with Google" + "Sign in with Email"
  - Auto-advance every 4.5s with manual swipe + keyboard navigation
  - Skip button removed (was getting cut off on some mobile widths)
  - Progress dots removed (more room for CTAs)
  - Gradient overlay for legibility above CTAs
- **JWT authentication** added alongside Emergent Google OAuth:
  - `/app/backend/jwt_auth.py` — register, login, refresh, logout, brute-force protection (X-Forwarded-For aware)
  - `/app/backend/auth.py:get_current_user` — tries JWT first, falls back to Emergent session_token
  - bcrypt password hashing; JWT access token (1d) + refresh token (30d) as httpOnly cookies (secure, samesite=none)
  - `_set_auth_cookies` clears stale Emergent `session_token` cookie on JWT login to prevent dual-auth conflict
  - Seeded users now have `password_hash` for `Sarun123#`
- **EmailAuthSheet component** (`/app/frontend/src/components/EmailAuthSheet.jsx`):
  - Bottom-sheet modal with email + password form
  - Toggle between Sign In and Create Account
  - Show/hide password, validation, error display
  - Calls `loginWithJWT` from AuthContext
- **AuthContext** extended with `loginWithJWT({mode, email, password, name})`
- Removed phantom `fcmService` dynamic import (file never existed)

### Tests (iteration_19.json)
- Backend: 12/13 pytest pass (brute-force fix verified post-fix: 6th attempt → 429)
- Frontend: full splash → JWT login → /prescription-manager flow works end-to-end on clean session

### Known Limitations
- Brute-force lockout uses email+IP (or email-only behind k8s); X-Forwarded-For-aware
- The api.js 401 handler still does `window.location.href='/'` — fragile. Future improvement: emit a React event instead.

---

## Session: Inner-screen Header Rebrand (May 5, 2026)

Updated all primary inner-screen sticky/top headers from teal/emerald gradients to the splash brand gradient `bg-gradient-to-r from-[#1E3A5F] via-[#2BA89F] to-[#7AB648]` (navy → teal → green) for visual consistency with the splash.

Files updated:
- `pages/HomePage.jsx` (top header + medication card gradient → navy/teal hero)
- `pages/ReportsPage.jsx`
- `pages/ChatPage.jsx`
- `pages/PersonalCarePage.jsx`
- `pages/ProfilePage.jsx` (header + avatar + tab active state)
- `pages/CaregiverDashboardPage.jsx`
- `pages/crm/CrmDashboard.jsx` (hero card)
- `pages/ProfileCreationPage.jsx` (avatar circle)
- `components/crm/CrmLayout.jsx` (sticky CRM header)
- `components/BottomNav.jsx` (active tab color → brand teal/navy)

Lint clean. Splash remains unchanged.

---

## Session: Decorative Pastel Backgrounds Rebrand (May 5, 2026)

Replaced the off-brand `from-emerald-50 to-teal-50` pastels with brand-tinted alternatives derived from the splash logo palette.

**Brand-tint palette introduced**:
- `#E6F4F2` — soft teal pastel (from #2BA89F)
- `#EEF2F7` — soft navy pastel (from #1E3A5F)
- `#F0F7E5` — soft green pastel (from #7AB648)

**Files updated**:
- `pages/ProfileCreationPage.jsx` — full-screen bg `from-[#E6F4F2] via-white to-[#EEF2F7]`
- `pages/PhoneSetupPage.jsx` — same brand-tint full-screen bg
- `pages/CartPage.jsx` — order-summary card → soft teal→green
- `pages/OrderConfirmationPage.jsx` — success banner → soft teal→green
- `pages/crm/CrmPatientDetail.jsx` — pending tasks card
- `pages/crm/CrmPatientOnboarding.jsx` — sync status card
- `pages/crm/CrmPatients.jsx` — patient avatar gradients
- `pages/PrescriptionManagerDashboard.jsx` — primary action button
- `pages/CaregiverInvitePage.jsx` — info box
- `pages/invoice/InvDashboard.jsx` — KPI tile + summary card
- `pages/invoice/InvSimpleInvoiceView.jsx` — invoice header band + amount tile
- `components/crm/CrmLayout.jsx` — user avatar gradient
- All `hover:bg-emerald-50` / `hover:bg-teal-50` → `hover:bg-[#2BA89F]/10` (app-wide sed)

**Intentionally preserved**:
- `bg-green-50` / `bg-red-50` semantic status badges (success / error) — these communicate state, not brand
- `text-green-600` adherence-success indicators
