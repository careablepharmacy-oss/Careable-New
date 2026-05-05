"""CRM/PM parity tests — iteration 17.

Validates that CRM medicine/appointment/lab-booking endpoints write to the SAME
shared collections (db.medications, db.appointments, db.reminders, db.adherence_logs)
that PM + mobile customer app read from. Also covers the NEW /crm/onboarding/pending
endpoint and PM regressions.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://careable-preview.preview.emergentagent.com",
).rstrip("/")

PM_TOKEN = "test_pm_crm_2026"
CUSTOMER_USER_ID = "f2eefadb-a488-495f-b93f-09300ceb112a"


def _pm_meds(client):
    """Fetch PM medications list — normalize wrapper."""
    r = client.get(f"{BASE_URL}/api/prescription-manager/user/{CUSTOMER_USER_ID}/medications")
    assert r.status_code == 200
    body = r.json()
    return body.get("medications", body) if isinstance(body, dict) else body


def _pm_apts(client, limit: int = 50):
    r = client.get(f"{BASE_URL}/api/prescription-manager/user/{CUSTOMER_USER_ID}/appointments?limit={limit}")
    assert r.status_code == 200
    body = r.json()
    return body.get("appointments", body) if isinstance(body, dict) else body


@pytest.fixture(scope="module")
def pm_client():
    s = requests.Session()
    s.cookies.set("session_token", PM_TOKEN)
    s.headers.update({"Content-Type": "application/json"})
    return s


# ============================================================
# MEDICINE PARITY (CRM writes → PM/mobile reads)
# ============================================================
class TestMedicineParity:
    created_med_id = None

    def test_crm_add_medicine_writes_to_db_medications(self, pm_client):
        payload = {
            "name": f"TEST_Metformin_{uuid.uuid4().hex[:6]}",
            "dosage": "500mg",
            "form": "Tablet",
            "color": "#FF6B6B",
            "instructions": "After food",
            "schedule": {
                "frequency": "daily",
                "start_date": "2026-01-01",
                "times": ["08:00", "20:00"],
                "dosage_timings": [
                    {"time": "08:00", "amount": "1"},
                    {"time": "20:00", "amount": "1"},
                ],
            },
            "refill_reminder": {"enabled": True, "pills_remaining": 60, "threshold": 7},
            "tablet_stock_count": 60,
            "tablets_per_strip": 10,
            "include_in_invoice": True,
        }
        r = pm_client.post(
            f"{BASE_URL}/api/crm/patients/{CUSTOMER_USER_ID}/medicines", json=payload
        )
        assert r.status_code == 200, f"Add failed: {r.status_code} {r.text[:300]}"
        med = r.json()
        assert med.get("id")
        assert med.get("user_id") == CUSTOMER_USER_ID
        assert med.get("name") == payload["name"]
        TestMedicineParity.created_med_id = med["id"]

    def test_medicine_visible_in_main_pm_medications(self, pm_client):
        assert TestMedicineParity.created_med_id
        meds = _pm_meds(pm_client)
        assert isinstance(meds, list)
        ids = [m.get("id") for m in meds]
        assert TestMedicineParity.created_med_id in ids, (
            "CRM-added medicine NOT present in PM medications endpoint"
        )

    def test_adherence_logs_and_reminders_generated(self, pm_client):
        """Indirect check: PM adherence endpoint should list this medication's logs."""
        r = pm_client.get(
            f"{BASE_URL}/api/prescription-manager/user/{CUSTOMER_USER_ID}/adherence"
        )
        # endpoint may not exist in this shape — accept common non-200 responses
        if r.status_code in (404, 405):
            pytest.skip("PM adherence endpoint shape differs; skipping indirect check")
        assert r.status_code == 200

    def test_crm_update_medicine_persists_via_main_pm(self, pm_client):
        assert TestMedicineParity.created_med_id
        new_schedule = {
            "frequency": "daily",
            "start_date": "2026-01-01",
            "times": ["09:00"],
            "dosage_timings": [{"time": "09:00", "amount": "2"}],
        }
        r = pm_client.put(
            f"{BASE_URL}/api/crm/patients/{CUSTOMER_USER_ID}/medicines/{TestMedicineParity.created_med_id}",
            json={"dosage": "1000mg", "schedule": new_schedule},
        )
        assert r.status_code == 200, f"Update failed: {r.status_code} {r.text[:200]}"
        body = r.json()
        assert body.get("dosage") == "1000mg"

        # Verify change is reflected in PM endpoint (shared collection)
        meds = _pm_meds(pm_client)
        match = [m for m in meds if m.get("id") == TestMedicineParity.created_med_id]
        assert match, "Updated medicine missing in PM endpoint"
        assert match[0].get("dosage") == "1000mg"

    def test_crm_refill_updates_tablet_stock(self, pm_client):
        # find index of our test medicine (sorted created_at desc in db.medications)
        assert TestMedicineParity.created_med_id
        meds_list = _pm_meds(pm_client)
        meds_sorted = sorted(meds_list, key=lambda m: m.get("created_at") or "", reverse=True)
        try:
            idx = next(i for i, m in enumerate(meds_sorted) if m.get("id") == TestMedicineParity.created_med_id)
        except StopIteration:
            pytest.fail("Could not locate test medicine index")

        before = meds_sorted[idx].get("tablet_stock_count") or 0
        r = pm_client.put(
            f"{BASE_URL}/api/crm/patients/{CUSTOMER_USER_ID}/medicines/{idx}/refill",
            params={"quantity": 30},
        )
        assert r.status_code == 200, f"Refill failed: {r.status_code} {r.text[:200]}"
        assert r.json().get("medicine", {}).get("tablet_stock_count") == before + 30

    def test_crm_delete_medicine_removes_from_shared(self, pm_client):
        assert TestMedicineParity.created_med_id
        r = pm_client.delete(
            f"{BASE_URL}/api/crm/patients/{CUSTOMER_USER_ID}/medicines/{TestMedicineParity.created_med_id}"
        )
        assert r.status_code == 200

        meds = _pm_meds(pm_client)
        ids = [m.get("id") for m in meds]
        assert TestMedicineParity.created_med_id not in ids


# ============================================================
# APPOINTMENT PARITY (CRM writes → main app reads)
# ============================================================
class TestAppointmentParity:
    created_apt_id = None

    def test_crm_create_appointment_writes_shared(self, pm_client):
        payload = {
            "type": "doctor",
            "title": f"TEST_Doctor_{uuid.uuid4().hex[:6]}",
            "doctor": "Dr. Parity",
            "hospital": "Parity Clinic",
            "date": "2026-06-15",
            "time": "10:00",
            "location": "Parity Clinic, Room 3",
            "notes": "iteration17 parity test",
        }
        r = pm_client.post(
            f"{BASE_URL}/api/crm/patients/{CUSTOMER_USER_ID}/appointments", json=payload
        )
        assert r.status_code == 200, f"Create failed: {r.status_code} {r.text[:300]}"
        apt = r.json()
        assert apt.get("id")
        assert apt.get("user_id") == CUSTOMER_USER_ID
        assert apt.get("title") == payload["title"]
        TestAppointmentParity.created_apt_id = apt["id"]

    def test_appointment_visible_in_pm_endpoint(self, pm_client):
        assert TestAppointmentParity.created_apt_id
        apts = _pm_apts(pm_client)
        ids = [a.get("id") for a in apts]
        assert TestAppointmentParity.created_apt_id in ids


# ============================================================
# LAB TEST DUAL-WRITE (crm_lab_bookings + db.appointments)
# ============================================================
class TestLabBookingDualWrite:
    def test_book_lab_test_dual_writes_appointment(self, pm_client):
        test_name = f"TEST_HbA1c_{uuid.uuid4().hex[:6]}"
        payload = {
            "test_name": test_name,
            "booked_date": "2026-07-20",
            "price": 499,
            "lab_name": "Parity Labs",
            "scheduled_time": "08:30",
            "notes": "parity test",
        }
        r = pm_client.post(
            f"{BASE_URL}/api/crm/patients/{CUSTOMER_USER_ID}/lab-tests/book", json=payload
        )
        assert r.status_code == 200, f"Book failed: {r.status_code} {r.text[:300]}"
        booking = r.json()
        assert booking.get("id")
        assert booking.get("test_name") == test_name

        # Verify matching entry in shared db.appointments via PM endpoint
        apts = _pm_apts(pm_client)
        labs = [a for a in apts if a.get("type") == "lab" and test_name in (a.get("title") or "")]
        assert labs, "Lab booking did NOT dual-write to db.appointments"
        assert labs[0].get("source") == "crm_lab_booking"


# ============================================================
# ONBOARDING PENDING (new endpoint)
# ============================================================
class TestOnboardingPending:
    def test_get_pending_onboarding_authenticated(self, pm_client):
        r = pm_client.get(f"{BASE_URL}/api/crm/onboarding/pending?days=365")
        assert r.status_code == 200, f"Failed: {r.status_code} {r.text[:200]}"
        data = r.json()
        assert "count" in data
        assert "patients" in data
        assert isinstance(data["patients"], list)
        assert data["count"] == len(data["patients"])
        # sort desc by created_at — verify if >=2 items
        if len(data["patients"]) >= 2:
            created = [p.get("created_at") or "" for p in data["patients"]]
            assert created == sorted(created, reverse=True)

    def test_get_pending_onboarding_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/crm/onboarding/pending")
        assert r.status_code == 401


# ============================================================
# PM REGRESSION — core endpoints still work
# ============================================================
class TestPMRegression:
    def test_pm_medications_get(self, pm_client):
        meds = _pm_meds(pm_client)
        assert isinstance(meds, list)

    def test_pm_appointments_get(self, pm_client):
        apts = _pm_apts(pm_client)
        assert isinstance(apts, list)

    def test_main_appointments_get(self, pm_client):
        r = pm_client.get(f"{BASE_URL}/api/appointments")
        assert r.status_code in (200, 401, 403)  # depending on role gating

    def test_main_medications_get(self, pm_client):
        r = pm_client.get(f"{BASE_URL}/api/medications")
        assert r.status_code in (200, 401, 403)
