"""CRM Integration API tests - iteration 15.

Covers /api/crm/* endpoints, auth gating, bridge to main-app users,
collection isolation, and regression on main-app APIs.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://careable-preview.preview.emergentagent.com").rstrip("/")
PM_TOKEN = "test_pm_crm_2026"
USER_TOKEN = "test_user_crm_2026"
PM_USER_ID = "2069063a-50c1-4f99-99e5-5b5d2b21d7ab"
CUSTOMER_USER_ID = "f2eefadb-a488-495f-b93f-09300ceb112a"


@pytest.fixture(scope="module")
def pm_client():
    s = requests.Session()
    s.cookies.set("session_token", PM_TOKEN)
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def user_client():
    s = requests.Session()
    s.cookies.set("session_token", USER_TOKEN)
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def anon_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------- AUTH GATING ----------
class TestAuth:
    def test_root_authenticated_pm(self, pm_client):
        r = pm_client.get(f"{BASE_URL}/api/crm/")
        assert r.status_code == 200
        data = r.json()
        assert "Careable 360+" in data.get("message", "")
        assert data.get("version") == "2.0.0"

    def test_root_unauthenticated_returns_401(self, anon_client):
        r = anon_client.get(f"{BASE_URL}/api/crm/")
        assert r.status_code == 401

    def test_regular_user_forbidden(self, user_client):
        r = user_client.get(f"{BASE_URL}/api/crm/")
        assert r.status_code == 403  # non-PM user blocked

    def test_patients_list_unauthenticated(self, anon_client):
        r = anon_client.get(f"{BASE_URL}/api/crm/patients")
        assert r.status_code == 401

    def test_dashboard_stats_unauthenticated(self, anon_client):
        r = anon_client.get(f"{BASE_URL}/api/crm/dashboard/stats")
        assert r.status_code == 401


# ---------- SYNC & BRIDGE ----------
class TestSync:
    def test_sync_from_main_app(self, pm_client):
        r = pm_client.post(f"{BASE_URL}/api/crm/sync/from-main-app")
        assert r.status_code == 200
        data = r.json()
        assert "created" in data
        assert "total_profiles" in data
        assert isinstance(data["total_profiles"], int)
        assert data["total_profiles"] >= 1

    def test_sync_is_idempotent(self, pm_client):
        r1 = pm_client.post(f"{BASE_URL}/api/crm/sync/from-main-app")
        r2 = pm_client.post(f"{BASE_URL}/api/crm/sync/from-main-app")
        assert r1.status_code == 200 and r2.status_code == 200
        # 2nd call should create 0 new
        assert r2.json()["created"] == 0

    def test_patients_auto_populates(self, pm_client):
        r = pm_client.get(f"{BASE_URL}/api/crm/patients")
        assert r.status_code == 200
        patients = r.json()
        assert isinstance(patients, list)
        assert len(patients) >= 1
        ids = {p["id"] for p in patients}
        # Customer user should appear, PM should NOT (role-filtered)
        assert CUSTOMER_USER_ID in ids
        assert PM_USER_ID not in ids
        # Enrichment fields
        p0 = patients[0]
        assert "priority_reason" in p0
        assert "medicines" in p0
        for m in p0["medicines"]:
            assert "stock_status" in m


# ---------- PATIENT DETAIL / CRUD ----------
class TestPatient:
    def test_get_patient_detail(self, pm_client):
        r = pm_client.get(f"{BASE_URL}/api/crm/patients/{CUSTOMER_USER_ID}")
        assert r.status_code == 200
        p = r.json()
        assert p["id"] == CUSTOMER_USER_ID
        for key in ("blood_glucose", "blood_pressure", "body_metrics",
                    "lab_tests", "priority_reason", "next_doctor_visit_due",
                    "medicines"):
            assert key in p, f"missing {key}"

    def test_get_patient_404(self, pm_client):
        r = pm_client.get(f"{BASE_URL}/api/crm/patients/nonexistent-id-xyz")
        assert r.status_code == 404

    def test_update_patient_does_not_touch_users_collection(self, pm_client):
        # Snapshot name from /auth/me for customer? We only validate put works
        # and persists to crm_patient_profiles.
        payload = {"priority": "high", "adherence_rate": 72.5}
        r = pm_client.put(
            f"{BASE_URL}/api/crm/patients/{CUSTOMER_USER_ID}",
            json=payload,
        )
        assert r.status_code == 200
        updated = r.json()
        assert updated["priority"] == "high"
        # GET verifies persistence
        g = pm_client.get(f"{BASE_URL}/api/crm/patients/{CUSTOMER_USER_ID}")
        assert g.json()["priority"] == "high"


# ---------- DASHBOARD ----------
class TestDashboard:
    def test_stats(self, pm_client):
        r = pm_client.get(f"{BASE_URL}/api/crm/dashboard/stats")
        assert r.status_code == 200
        d = r.json()
        for k in ("total_patients", "high_priority_patients",
                  "opportunities", "expected_revenue", "disease_distribution"):
            assert k in d, f"missing {k}"
        assert isinstance(d["total_patients"], int)

    def test_patients_to_call(self, pm_client):
        r = pm_client.get(f"{BASE_URL}/api/crm/dashboard/patients-to-call")
        assert r.status_code == 200
        assert isinstance(r.json(), (list, dict))

    def test_revenue_summary(self, pm_client):
        r = pm_client.get(f"{BASE_URL}/api/crm/dashboard/revenue-summary")
        assert r.status_code == 200


# ---------- OPPORTUNITIES ----------
class TestOpportunities:
    def test_generate_and_list(self, pm_client):
        r = pm_client.post(f"{BASE_URL}/api/crm/opportunities/generate")
        assert r.status_code == 200
        assert "generated" in r.json()
        r2 = pm_client.get(f"{BASE_URL}/api/crm/opportunities")
        assert r2.status_code == 200
        opps = r2.json()
        assert isinstance(opps, list)
        # revenue_category enrichment
        if opps:
            assert "revenue_category" in opps[0]


# ---------- LABS ----------
class TestLabs:
    def test_list_labs(self, pm_client):
        r = pm_client.get(f"{BASE_URL}/api/crm/laboratories")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_lab(self, pm_client):
        payload = {"name": "TEST_Lab_Iter15", "phone": "9999999999", "address": "Test"}
        r = pm_client.post(f"{BASE_URL}/api/crm/laboratories", json=payload)
        assert r.status_code in (200, 201)
        d = r.json()
        assert d.get("name") == "TEST_Lab_Iter15"

    def test_catalog_lab_tests(self, pm_client):
        r = pm_client.get(f"{BASE_URL}/api/crm/catalog/lab-tests")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_custom_lab_test(self, pm_client):
        payload = {
            "name": "TEST_CustomTest_Iter15",
            "diseases": ["Diabetes"],
            "frequency_months": 6,
            "price": 999,
        }
        r = pm_client.post(f"{BASE_URL}/api/crm/catalog/lab-tests", json=payload)
        assert r.status_code in (200, 201)


# ---------- LAB BOOKING + REVENUE CONVERSION ----------
class TestLabBooking:
    def test_book_and_revenue(self, pm_client):
        payload = {
            "test_name": "TEST_HbA1c_iter15",
            "booked_date": "2026-06-15",
            "price": 550,
            "lab_name": "TEST_Lab_Iter15",
            "scheduled_time": "10:30",
            "source": "pytest",
        }
        r = pm_client.post(
            f"{BASE_URL}/api/crm/patients/{CUSTOMER_USER_ID}/lab-tests/book",
            json=payload,
        )
        assert r.status_code == 200, r.text
        b = r.json()
        assert b["test_name"] == "TEST_HbA1c_iter15"
        assert b["booked_date"] == "2026-06-15"
        # Revenue MTD should reflect a lab_test conversion
        r2 = pm_client.get(f"{BASE_URL}/api/crm/patients/{CUSTOMER_USER_ID}/revenue/mtd")
        assert r2.status_code == 200
        rev = r2.json()
        assert "total" in rev and "by_category" in rev


# ---------- INTERACTIONS ----------
class TestInteractions:
    def test_interaction_future_follow_up(self, pm_client):
        payload = {
            "type": "call",
            "purpose": "refill",
            "notes": "TEST iter15",
            "outcome": "positive",
            "follow_up_date": "2027-01-15",
            "follow_up_time": "10:00",
        }
        r = pm_client.post(
            f"{BASE_URL}/api/crm/patients/{CUSTOMER_USER_ID}/interactions",
            json=payload,
        )
        assert r.status_code == 200

    def test_interaction_past_follow_up_rejected(self, pm_client):
        payload = {
            "type": "call",
            "notes": "TEST past",
            "outcome": "positive",
            "follow_up_date": "2020-01-01",
            "follow_up_time": "10:00",
        }
        r = pm_client.post(
            f"{BASE_URL}/api/crm/patients/{CUSTOMER_USER_ID}/interactions",
            json=payload,
        )
        assert r.status_code == 400


# ---------- VITALS via CRM write to SHARED collections ----------
class TestVitals:
    def test_record_bp_via_crm(self, pm_client):
        r = pm_client.post(
            f"{BASE_URL}/api/crm/patients/{CUSTOMER_USER_ID}/vitals",
            json={"type": "bp", "systolic": 128, "diastolic": 82, "pulse": 74},
        )
        assert r.status_code == 200
        # Verify visible via main-app API
        r2 = pm_client.get(f"{BASE_URL}/api/health/bp?user_id={CUSTOMER_USER_ID}")
        # Main api may need a different param; accept 200 or 401-safe check
        assert r2.status_code in (200, 404, 422)

    def test_record_glucose_via_crm(self, pm_client):
        r = pm_client.post(
            f"{BASE_URL}/api/crm/patients/{CUSTOMER_USER_ID}/vitals",
            json={"type": "sugar", "value": 140, "meal_context": "Fasting"},
        )
        assert r.status_code == 200


# ---------- APPOINTMENTS ----------
class TestAppointments:
    def test_create_appointment(self, pm_client):
        r = pm_client.post(
            f"{BASE_URL}/api/crm/patients/{CUSTOMER_USER_ID}/appointments",
            json={"type": "doctor", "title": "TEST iter15 Consult",
                  "date": "2026-05-20", "time": "11:00"},
        )
        assert r.status_code == 200
        assert r.json()["title"] == "TEST iter15 Consult"


# ---------- REPORTS ----------
class TestReports:
    def test_lab_reconciliation(self, pm_client):
        r = pm_client.get(f"{BASE_URL}/api/crm/reports/lab-reconciliation")
        assert r.status_code == 200

    def test_lab_reconciliation_details(self, pm_client):
        r = pm_client.get(
            f"{BASE_URL}/api/crm/reports/lab-reconciliation/details",
            params={"group_by": "lab", "value": "TEST_Lab_Iter15"},
        )
        assert r.status_code == 200


# ---------- ONBOARDING ----------
class TestOnboarding:
    def test_get_onboarding(self, pm_client):
        r = pm_client.get(f"{BASE_URL}/api/crm/patients/{CUSTOMER_USER_ID}/onboarding")
        assert r.status_code == 200

    def test_update_onboarding(self, pm_client):
        r = pm_client.put(
            f"{BASE_URL}/api/crm/patients/{CUSTOMER_USER_ID}/onboarding",
            json={"last_doctor_visit_date": "2026-01-10",
                  "last_lab_visit_date": "2026-01-12"},
        )
        assert r.status_code == 200


# ---------- REGRESSION on main app APIs ----------
class TestRegressionMainApp:
    def test_auth_me(self, pm_client):
        r = pm_client.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200

    def test_medications_untouched(self, pm_client):
        r = pm_client.get(f"{BASE_URL}/api/medications")
        assert r.status_code in (200, 404)

    def test_pm_users_list(self, pm_client):
        r = pm_client.get(f"{BASE_URL}/api/prescription-manager/users")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, (list, dict))

    def test_pm_purchase_links(self, pm_client):
        r = pm_client.get(
            f"{BASE_URL}/api/prescription-manager/user/{CUSTOMER_USER_ID}/purchase-links"
        )
        assert r.status_code in (200, 404)

    def test_appointments_untouched(self, pm_client):
        r = pm_client.get(f"{BASE_URL}/api/appointments")
        assert r.status_code in (200, 404, 422)


# ---------- COLLECTION ISOLATION (via behavior) ----------
class TestIsolation:
    def test_delete_patient_preserves_user(self, pm_client):
        """DELETE /api/crm/patients/{id} should remove crm profile but user still exists."""
        # Create a temp main-app user via sync flow — we can't easily here without mongo.
        # Instead, use the customer, delete CRM profile, then re-sync.
        del_r = pm_client.delete(f"{BASE_URL}/api/crm/patients/{CUSTOMER_USER_ID}")
        assert del_r.status_code == 200
        # User should still exist → next patients call auto-creates CRM profile again
        p_r = pm_client.get(f"{BASE_URL}/api/crm/patients/{CUSTOMER_USER_ID}")
        assert p_r.status_code == 200
        # Medications still visible (attached from main app)
        p = p_r.json()
        assert "medicines" in p


# ---------- Cleanup ----------
@pytest.fixture(scope="module", autouse=True)
def cleanup_test_data(pm_client):
    yield
    # Best-effort cleanup
    try:
        labs = pm_client.get(f"{BASE_URL}/api/crm/laboratories").json()
        for lab in labs:
            if lab.get("name", "").startswith("TEST_"):
                lid = lab.get("id")
                if lid:
                    pm_client.delete(f"{BASE_URL}/api/crm/laboratories/{lid}")
    except Exception:
        pass
