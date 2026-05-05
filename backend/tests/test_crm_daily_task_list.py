"""CRM Daily Task List (iteration 18) — backend tests.

Covers three NEW endpoints:
  - GET  /api/crm/dashboard/patients-to-call-grouped
  - GET  /api/crm/patients/{id}/pending-tasks
  - POST /api/crm/patients/{id}/tasks/toggle

Plus regression: old flat /api/crm/dashboard/patients-to-call still works.
"""
import os
import uuid
import time
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
PM_TOKEN = "test_pm_crm_2026"
CUSTOMER_USER_ID = "f2eefadb-a488-495f-b93f-09300ceb112a"

_MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
_DB_NAME = os.environ.get("DB_NAME", "test_database")


@pytest.fixture(scope="module")
def mongo_db():
    client = MongoClient(_MONGO_URL)
    yield client[_DB_NAME]
    client.close()


@pytest.fixture(scope="module")
def pm_client():
    s = requests.Session()
    s.cookies.set("session_token", PM_TOKEN)
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def anon_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module", autouse=True)
def ensure_opportunities(pm_client):
    """Seed opportunities so we have data to group on."""
    try:
        pm_client.post(f"{BASE_URL}/api/crm/opportunities/generate", timeout=60)
    except Exception:
        pass
    yield


# ============================================================
# 1. Auth gating
# ============================================================
class TestAuthGating:
    def test_grouped_requires_pm_session(self, anon_client):
        r = anon_client.get(f"{BASE_URL}/api/crm/dashboard/patients-to-call-grouped")
        assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code}"

    def test_grouped_200_with_pm_session(self, pm_client):
        r = pm_client.get(f"{BASE_URL}/api/crm/dashboard/patients-to-call-grouped")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_pending_tasks_requires_pm(self, anon_client):
        r = anon_client.get(
            f"{BASE_URL}/api/crm/patients/{CUSTOMER_USER_ID}/pending-tasks"
        )
        assert r.status_code in (401, 403)

    def test_toggle_requires_pm(self, anon_client):
        r = anon_client.post(
            f"{BASE_URL}/api/crm/patients/{CUSTOMER_USER_ID}/tasks/toggle",
            json={"task_id": "x", "task_type": "opportunity", "done": True},
        )
        assert r.status_code in (401, 403)


# ============================================================
# 2. Grouped endpoint — shape + aggregation
# ============================================================
class TestGroupedEndpoint:
    def test_response_shape(self, pm_client):
        r = pm_client.get(f"{BASE_URL}/api/crm/dashboard/patients-to-call-grouped")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        if not data:
            pytest.skip("No grouped task data to validate shape on")
        item = data[0]
        required = {
            "patient_id", "patient_name", "priority", "task_counts",
            "total_tasks", "expected_revenue", "overall_status", "task_types",
        }
        missing = required - set(item.keys())
        assert not missing, f"missing fields: {missing}"
        assert isinstance(item["task_counts"], dict)
        assert isinstance(item["task_types"], list)
        assert isinstance(item["total_tasks"], int)

    def test_unique_patients_no_duplicates(self, pm_client):
        r = pm_client.get(f"{BASE_URL}/api/crm/dashboard/patients-to-call-grouped")
        data = r.json()
        pids = [g["patient_id"] for g in data]
        assert len(pids) == len(set(pids)), "grouped response contains duplicate patient_ids"

    def test_total_tasks_matches_task_counts(self, pm_client):
        r = pm_client.get(f"{BASE_URL}/api/crm/dashboard/patients-to-call-grouped")
        for g in r.json():
            assert g["total_tasks"] == sum(g["task_counts"].values()), (
                f"total_tasks {g['total_tasks']} != sum {sum(g['task_counts'].values())} "
                f"for patient {g['patient_id']}"
            )

    def test_aggregation_matches_flat_endpoint(self, pm_client):
        """If a patient has N non-completed tasks in flat endpoint, grouped total_tasks == N."""
        flat = pm_client.get(f"{BASE_URL}/api/crm/dashboard/patients-to-call").json()
        grouped = pm_client.get(
            f"{BASE_URL}/api/crm/dashboard/patients-to-call-grouped"
        ).json()

        # count non-completed per patient from flat
        flat_counts = {}
        for e in flat:
            if e.get("status") == "completed":
                continue
            if e.get("patient_id"):
                flat_counts[e["patient_id"]] = flat_counts.get(e["patient_id"], 0) + 1

        grouped_counts = {g["patient_id"]: g["total_tasks"] for g in grouped}

        # every grouped entry must match flat aggregation
        for pid, count in grouped_counts.items():
            assert flat_counts.get(pid) == count, (
                f"patient {pid}: grouped total_tasks={count} but flat non-completed count={flat_counts.get(pid)}"
            )

    def test_sort_order_urgency_then_priority(self, pm_client):
        r = pm_client.get(f"{BASE_URL}/api/crm/dashboard/patients-to-call-grouped")
        data = r.json()
        if len(data) < 2:
            pytest.skip("need >=2 groups to verify sort")
        status_rank = {"overdue": 0, "pending": 1, "upcoming": 2, "completed": 3}
        pr_rank = {"high": 0, "medium": 1, "low": 2}
        prev = None
        for g in data:
            cur = (
                status_rank.get(g["overall_status"], 4),
                pr_rank.get(g["priority"], 3),
                -g["total_tasks"],
                -float(g["expected_revenue"] or 0),
            )
            if prev is not None:
                assert prev <= cur, f"sort violated: {prev} > {cur}"
            prev = cur


# ============================================================
# 3. Per-patient pending tasks
# ============================================================
class TestPendingTasks:
    def test_flat_list_for_existing_patient(self, pm_client):
        r = pm_client.get(
            f"{BASE_URL}/api/crm/patients/{CUSTOMER_USER_ID}/pending-tasks"
        )
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        for t in data:
            assert "task_type" in t
            assert t.get("status") != "completed"

    def test_pending_tasks_all_belong_to_patient(self, pm_client):
        r = pm_client.get(
            f"{BASE_URL}/api/crm/patients/{CUSTOMER_USER_ID}/pending-tasks"
        )
        for t in r.json():
            # every task that has a patient_id must belong to this patient
            if t.get("patient_id"):
                assert t["patient_id"] == CUSTOMER_USER_ID


# ============================================================
# 4. Toggle endpoint
# ============================================================
class TestToggle:
    def test_unknown_task_type_returns_400(self, pm_client):
        r = pm_client.post(
            f"{BASE_URL}/api/crm/patients/{CUSTOMER_USER_ID}/tasks/toggle",
            json={"task_id": "fake-id", "task_type": "mystery", "done": True},
        )
        assert r.status_code == 400

    def test_opportunity_toggle_removes_from_grouped(self, pm_client, mongo_db):
        """Seed a fresh patient + opp via pymongo, toggle it done, verify it drops from flat + grouped.

        Uses a dedicated TEST_ patient to avoid 'already contacted today' filtering on the
        real demo user (which can hide seeded opportunities as 'completed').
        """
        test_pid = f"TEST_pat_{uuid.uuid4().hex[:8]}"
        profile = {
            "id": test_pid,
            "name": "TEST_CRM_Patient_Toggle",
            "phone": "9999999999",
            "email": f"{test_pid}@test.com",
            "priority": "high",
            "interactions": [],
            "created_at": "2025-01-01T00:00:00+00:00",
            "updated_at": "2025-01-01T00:00:00+00:00",
        }
        mongo_db.crm_patient_profiles.insert_one(dict(profile))

        opp_id = f"TEST_opp_{uuid.uuid4().hex[:8]}"
        opp = {
            "id": opp_id,
            "patient_id": test_pid,
            "patient_name": "TEST_CRM_Patient_Toggle",
            "type": "refill",
            "opportunity_type": "refill",
            "priority": "high",
            "status": "pending",
            "description": "TEST_opp for toggle test",
            "expected_revenue": 100,
            "revenue": 100,
            "follow_up_time": "2026-01-01T10:00:00+00:00",
            "created_at": "2026-01-01T10:00:00+00:00",
        }
        mongo_db.crm_opportunities.insert_one(dict(opp))

        try:
            # confirm it exists in flat as pending (not already contacted today)
            flat = pm_client.get(f"{BASE_URL}/api/crm/dashboard/patients-to-call").json()
            mine_flat = [e for e in flat if e.get("id") == opp_id]
            assert mine_flat and mine_flat[0].get("status") == "pending", (
                f"seeded opp should be pending in flat: {mine_flat}"
            )

            # confirm grouped has this patient with total_tasks>=1
            grouped = pm_client.get(
                f"{BASE_URL}/api/crm/dashboard/patients-to-call-grouped"
            ).json()
            my_group = next((g for g in grouped if g["patient_id"] == test_pid), None)
            assert my_group is not None, "seeded patient not in grouped response"
            assert my_group["total_tasks"] >= 1
            assert "opportunity" in my_group["task_counts"]

            # toggle done
            r = pm_client.post(
                f"{BASE_URL}/api/crm/patients/{test_pid}/tasks/toggle",
                json={"task_id": opp_id, "task_type": "opportunity", "done": True},
            )
            assert r.status_code == 200, r.text

            time.sleep(0.3)

            # verify db doc updated
            doc = mongo_db.crm_opportunities.find_one({"id": opp_id})
            assert doc and doc["status"] == "converted", f"opp status not updated: {doc}"

            # verify gone from flat (filtered by status=pending)
            flat2 = pm_client.get(f"{BASE_URL}/api/crm/dashboard/patients-to-call").json()
            assert not any(e.get("id") == opp_id for e in flat2), (
                "toggled opp still appears in flat"
            )

            # verify gone from /pending-tasks for this patient
            pending = pm_client.get(
                f"{BASE_URL}/api/crm/patients/{test_pid}/pending-tasks"
            ).json()
            assert not any(t.get("id") == opp_id for t in pending), (
                "toggled opp still in pending-tasks"
            )

            # verify this patient's opportunity task_count is now 0 in grouped
            grouped2 = pm_client.get(
                f"{BASE_URL}/api/crm/dashboard/patients-to-call-grouped"
            ).json()
            g2 = next((g for g in grouped2 if g["patient_id"] == test_pid), None)
            if g2 is not None:
                assert g2["task_counts"].get("opportunity", 0) == 0, (
                    f"opportunity count should be 0 after toggle, got {g2['task_counts']}"
                )
        finally:
            mongo_db.crm_opportunities.delete_one({"id": opp_id})
            mongo_db.crm_patient_profiles.delete_one({"id": test_pid})

    def test_opportunity_404_for_missing_id(self, pm_client):
        r = pm_client.post(
            f"{BASE_URL}/api/crm/patients/{CUSTOMER_USER_ID}/tasks/toggle",
            json={"task_id": "nonexistent-opp-xyz", "task_type": "opportunity", "done": True},
        )
        assert r.status_code == 404

    def test_follow_up_toggle_records_interaction(self, pm_client):
        r = pm_client.post(
            f"{BASE_URL}/api/crm/patients/{CUSTOMER_USER_ID}/tasks/toggle",
            json={"task_id": "any", "task_type": "follow_up", "done": True},
        )
        assert r.status_code == 200
        body = r.json()
        assert "interaction_id" in body

    def test_onboarding_toggle(self, pm_client):
        r = pm_client.post(
            f"{BASE_URL}/api/crm/patients/{CUSTOMER_USER_ID}/tasks/toggle",
            json={"task_id": "onboarding-x", "task_type": "onboarding", "done": True},
        )
        assert r.status_code == 200


# ============================================================
# 5. Regression — flat endpoint still works
# ============================================================
class TestFlatRegression:
    def test_flat_endpoint_still_works(self, pm_client):
        r = pm_client.get(f"{BASE_URL}/api/crm/dashboard/patients-to-call")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_onboarding_pending_still_works(self, pm_client):
        r = pm_client.get(f"{BASE_URL}/api/crm/onboarding/pending")
        assert r.status_code == 200
