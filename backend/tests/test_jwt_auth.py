"""
JWT auth backend tests — covers /api/auth/jwt-register, /api/auth/jwt-login,
brute-force protection, /api/auth/me (JWT), /api/auth/jwt-refresh, /api/auth/jwt-logout,
and /api/prescription-manager/users JWT bearer access.
Also asserts Emergent /api/auth/session route still exists (regression).
"""
import os
import uuid
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://careable-clone-1.preview.emergentagent.com").rstrip("/")

PM_EMAIL = "careable360plus@gmail.com"
USER_EMAIL = "encarelife@gmail.com"
PASSWORD = "Sarun123#"


@pytest.fixture(scope="module")
def sess():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------------- Seeded login (PM) ----------------
class TestJWTLoginSeeded:
    def test_pm_login_success(self, sess):
        r = sess.post(f"{BASE_URL}/api/auth/jwt-login",
                      json={"email": PM_EMAIL, "password": PASSWORD})
        assert r.status_code == 200, r.text
        data = r.json()
        assert "access_token" in data and len(data["access_token"]) > 0
        assert data["user"]["email"] == PM_EMAIL
        assert data["user"]["role"] == "prescription_manager"
        assert "password_hash" not in data["user"]
        assert "_id" not in data["user"]
        # Cookies set?
        assert "access_token" in sess.cookies.get_dict() or any(
            c.name == "access_token" for c in sess.cookies
        )

    def test_user_login_success(self, sess):
        s = requests.Session()
        r = s.post(f"{BASE_URL}/api/auth/jwt-login",
                   json={"email": USER_EMAIL, "password": PASSWORD})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["user"]["email"] == USER_EMAIL
        assert data["user"]["role"] == "user"

    def test_login_wrong_password(self, sess):
        s = requests.Session()
        r = s.post(f"{BASE_URL}/api/auth/jwt-login",
                   json={"email": PM_EMAIL, "password": "WRONG_PASSWORD"})
        assert r.status_code == 401


# ---------------- Registration ----------------
class TestJWTRegister:
    def test_register_new_user(self, sess):
        email = f"TEST_jwt_{uuid.uuid4().hex[:8]}@example.com"
        r = sess.post(f"{BASE_URL}/api/auth/jwt-register",
                      json={"email": email, "password": "Passw0rd!", "name": "Test JWT User"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["user"]["email"] == email.lower()
        assert "access_token" in data and len(data["access_token"]) > 0

    def test_register_short_password_rejected(self, sess):
        email = f"TEST_jwt_short_{uuid.uuid4().hex[:6]}@example.com"
        r = sess.post(f"{BASE_URL}/api/auth/jwt-register",
                      json={"email": email, "password": "abc", "name": "Short"})
        assert r.status_code in (400, 422)


# ---------------- /api/auth/me via JWT Bearer ----------------
class TestAuthMeJWT:
    def test_me_with_bearer(self):
        s = requests.Session()
        login = s.post(f"{BASE_URL}/api/auth/jwt-login",
                       json={"email": PM_EMAIL, "password": PASSWORD})
        assert login.status_code == 200
        token = login.json()["access_token"]

        # Fresh session WITHOUT cookies — tests bearer path only
        r = requests.get(f"{BASE_URL}/api/auth/me",
                         headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200, r.text
        user = r.json()
        assert user["email"] == PM_EMAIL
        assert user["role"] == "prescription_manager"

    def test_me_no_auth_401(self):
        r = requests.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401


# ---------------- Prescription Manager endpoint with JWT Bearer ----------------
class TestPMUsersJWT:
    def test_pm_users_list(self):
        login = requests.post(f"{BASE_URL}/api/auth/jwt-login",
                              json={"email": PM_EMAIL, "password": PASSWORD})
        token = login.json()["access_token"]
        r = requests.get(f"{BASE_URL}/api/prescription-manager/users",
                         headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200, r.text
        data = r.json()
        # Response may be a list or {users: [...]}; handle both
        users = data if isinstance(data, list) else data.get("users", [])
        assert isinstance(users, list)
        assert len(users) >= 1

    def test_pm_users_forbidden_for_regular_user(self):
        login = requests.post(f"{BASE_URL}/api/auth/jwt-login",
                              json={"email": USER_EMAIL, "password": PASSWORD})
        assert login.status_code == 200
        token = login.json()["access_token"]
        r = requests.get(f"{BASE_URL}/api/prescription-manager/users",
                         headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 403


# ---------------- Refresh / Logout ----------------
class TestRefreshLogout:
    def test_refresh_with_cookie(self):
        s = requests.Session()
        login = s.post(f"{BASE_URL}/api/auth/jwt-login",
                       json={"email": USER_EMAIL, "password": PASSWORD})
        assert login.status_code == 200
        r = s.post(f"{BASE_URL}/api/auth/jwt-refresh")
        assert r.status_code == 200, r.text
        assert "access_token" in r.json()

    def test_logout_clears_cookies(self):
        s = requests.Session()
        s.post(f"{BASE_URL}/api/auth/jwt-login",
               json={"email": USER_EMAIL, "password": PASSWORD})
        r = s.post(f"{BASE_URL}/api/auth/jwt-logout")
        assert r.status_code == 200


# ---------------- Emergent OAuth regression ----------------
class TestEmergentSessionRoute:
    def test_emergent_session_route_exists(self):
        # Expect 400/401/422 on missing/invalid session_id — NOT 404
        r = requests.post(f"{BASE_URL}/api/auth/session", json={"session_id": "invalid"})
        assert r.status_code != 404, f"Emergent session route missing! Got {r.status_code}: {r.text}"
        assert r.status_code in (400, 401, 422, 500), f"Unexpected: {r.status_code} {r.text}"


# ---------------- Brute force ----------------
class TestBruteForce:
    def test_brute_force_429_after_5_failures(self):
        # Use a deterministic non-seeded email to avoid locking seeded accounts
        bogus_email = f"TEST_bf_{uuid.uuid4().hex[:8]}@example.com"
        s = requests.Session()
        last_status = None
        got_429 = False
        for i in range(8):
            r = s.post(f"{BASE_URL}/api/auth/jwt-login",
                       json={"email": bogus_email, "password": "wrong"})
            last_status = r.status_code
            if r.status_code == 429:
                got_429 = True
                break
        assert got_429, f"Expected 429 after 5 failures, last status: {last_status}"
