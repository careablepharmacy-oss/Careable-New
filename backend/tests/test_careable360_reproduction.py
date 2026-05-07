"""
Iteration 18 - Reproduction validation tests for Careable 360+plus.

Validates:
- Backend health & scheduler
- Public endpoints: medications/autocomplete
- Auth-protected endpoints return 401 unauthenticated
- Seeded mock data presence in MongoDB
- Rebrand correctness (helpers.py ADMIN_EMAIL, auth.py role mapping, no enCARE/EnCARE)
- EMERGENT_LLM_KEY loaded
"""
import os
import re
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://careable-clone-1.preview.emergentagent.com").rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "careable360_db")


# ---------- Shared fixtures ----------
@pytest.fixture(scope="session")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def db():
    client = MongoClient(MONGO_URL)
    return client[DB_NAME]


# ---------- Backend health & public endpoints ----------
class TestBackendHealth:
    def test_root_or_health_responds(self, api):
        # FastAPI must answer at least one /api/* endpoint with non-5xx
        r = api.get(f"{BASE_URL}/api/medications/autocomplete?q=met", timeout=15)
        assert r.status_code < 500, f"Server 5xx: {r.status_code} {r.text[:200]}"

    def test_medications_autocomplete_public_returns_200(self, api):
        r = api.get(f"{BASE_URL}/api/medications/autocomplete?q=met", timeout=15)
        assert r.status_code == 200
        body = r.json()
        # empty seed list is acceptable per problem statement
        assert isinstance(body, list)


# ---------- Auth-protected endpoints must return 401 unauthenticated ----------
class TestAuthProtected:
    @pytest.mark.parametrize("path", [
        "/api/auth/me",
        "/api/medications",
        "/api/orders",
        "/api/inv/invoices",
    ])
    def test_protected_returns_401_without_session(self, api, path):
        r = api.get(f"{BASE_URL}{path}", timeout=15)
        assert r.status_code in (401, 403), f"{path} expected 401/403, got {r.status_code} {r.text[:200]}"


# ---------- Seeded mock data presence ----------
class TestSeededData:
    def test_users_seeded(self, db):
        users = list(db.users.find({}, {"_id": 0, "email": 1, "role": 1}))
        emails = {u["email"]: u.get("role") for u in users}
        assert "careable360plus@gmail.com" in emails
        assert emails["careable360plus@gmail.com"] == "prescription_manager"
        assert "encarelife@gmail.com" in emails
        assert emails["encarelife@gmail.com"] == "user"

    def test_medications_seeded_for_customer(self, db):
        customer = db.users.find_one({"email": "encarelife@gmail.com"}, {"_id": 0, "id": 1})
        assert customer, "customer user missing"
        assert db.medications.count_documents({"user_id": customer["id"]}) == 5

    def test_products_seeded(self, db):
        assert db.products.count_documents({}) == 3

    def test_invoices_seeded(self, db):
        assert db.inv_invoices.count_documents({}) == 2

    def test_orders_seeded(self, db):
        assert db.orders.count_documents({}) == 2

    def test_crm_patient_profile_seeded(self, db):
        # Review-request mentioned 'crm_patient_profile' (singular). Actual collection is crm_patient_profiles (plural).
        assert db.crm_patient_profiles.count_documents({}) >= 1

    def test_crm_revenue_conversions_seeded(self, db):
        assert db.crm_revenue_conversions.count_documents({}) == 1

    def test_user_purchase_links_seeded(self, db):
        assert db.user_purchase_links.count_documents({}) == 1


# ---------- Rebrand correctness in code ----------
class TestRebrandCorrectness:
    def test_helpers_admin_email_is_careable360(self):
        from helpers import ADMIN_EMAIL  # type: ignore
        assert ADMIN_EMAIL == "careable360plus@gmail.com", f"ADMIN_EMAIL mismatch: {ADMIN_EMAIL}"

    def test_auth_role_mapping(self):
        from auth import determine_user_role  # type: ignore
        assert determine_user_role("careable360plus@gmail.com") == "prescription_manager"
        assert determine_user_role("encarelife@gmail.com") == "user"
        assert determine_user_role("random@example.com") == "user"

    def test_no_brand_encare_in_main_python_sources(self):
        """Case-sensitive search for 'enCARE' / 'EnCARE' in backend python source files
        (excluding tests/, utility scripts, and seed). The lowercase identifier
        'encare_user_id' (CRM legacy field name) is intentional and not user-visible."""
        offenders = []
        backend_root = "/app/backend"
        skip_dirs = {"tests", "__pycache__"}
        skip_files = {"server_old.py", "seed_mock_data.py"}
        pat = re.compile(r"enCARE|EnCARE|ENCARE")
        for root, dirs, files in os.walk(backend_root):
            dirs[:] = [d for d in dirs if d not in skip_dirs]
            for f in files:
                if not f.endswith(".py") or f in skip_files:
                    continue
                p = os.path.join(root, f)
                try:
                    with open(p, "r", encoding="utf-8") as fh:
                        for i, line in enumerate(fh, 1):
                            if pat.search(line):
                                offenders.append(f"{p}:{i}: {line.strip()[:120]}")
                except Exception:
                    pass
        assert not offenders, "Brand 'enCARE/EnCARE' still present in main backend python:\n" + "\n".join(offenders)


# ---------- Env / LLM init ----------
class TestEnvAndLLM:
    def test_emergent_llm_key_loaded(self):
        # backend reads from .env via python-dotenv at startup; assert env is set
        # by parsing the .env file directly (env may not be inherited into pytest process)
        env_path = "/app/backend/.env"
        with open(env_path, "r") as f:
            content = f.read()
        m = re.search(r"^EMERGENT_LLM_KEY=(\S+)\s*$", content, re.MULTILINE)
        assert m, "EMERGENT_LLM_KEY missing in /app/backend/.env"
        assert m.group(1).startswith("sk-emergent-"), "EMERGENT_LLM_KEY format unexpected"

    def test_db_name_is_careable360_db(self):
        env_path = "/app/backend/.env"
        with open(env_path, "r") as f:
            content = f.read()
        m = re.search(r"^DB_NAME=(\S+)\s*$", content, re.MULTILINE)
        assert m and m.group(1) == "careable360_db"
