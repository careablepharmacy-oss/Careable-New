"""Delivery tracking service.

v1 supports ClickPost-powered tracking pages (1mg, etc.).
Uses Playwright headless to bypass Cloudflare and intercept the JSON
response from the page's internal /api/tracking endpoint.

Adding new carriers later = register a new fetcher in CARRIER_FETCHERS.
"""
import asyncio
import logging
import os
import re
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List, Tuple
from urllib.parse import urlparse, parse_qs

logger = logging.getLogger(__name__)

# Make sure Playwright finds the pre-installed browser
os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", "/pw-browsers")


# ---------------- Status normalization ----------------

# ClickPost status_bucket mapping (their public docs):
#  1=Order placed, 2=Pickup pending, 3=In Transit, 4=Out for delivery,
#  5=Failed delivery, 6=Delivered, 7=RTO, 8=Lost, 9=Cancelled, 10=Pickup completed
CLICKPOST_BUCKET_TO_STATUS = {
    1: "Pending",
    2: "Pending",
    3: "In Transit",
    4: "Out for Delivery",
    5: "Failed",
    6: "Delivered",
    7: "Failed",
    8: "Failed",
    9: "Cancelled",
    10: "Shipped",
}

# Statuses we treat as "terminal" - skip auto-refresh
TERMINAL_STATUSES = {"Delivered", "Cancelled", "Failed"}


# ---------------- Carrier detection ----------------

CARRIER_PATTERNS = [
    (re.compile(r"clickpost\.in", re.I), "ClickPost"),
    (re.compile(r"1mg\.com", re.I), "1mg"),
    (re.compile(r"delhivery\.com", re.I), "Delhivery"),
    (re.compile(r"shiprocket\.in", re.I), "Shiprocket"),
    (re.compile(r"bluedart\.com", re.I), "BlueDart"),
]


def detect_carrier(url: str) -> str:
    if not url:
        return "Unknown"
    for pat, name in CARRIER_PATTERNS:
        if pat.search(url):
            return name
    return "Unknown"


def extract_waybill(url: str) -> Optional[str]:
    if not url:
        return None
    try:
        parsed = urlparse(url)
        params = parse_qs(parsed.query)
        for k in ("waybill", "awb", "tracking_id", "trackingid"):
            if k in params and params[k]:
                return params[k][0]
    except Exception:
        pass
    return None


# ---------------- ClickPost fetcher ----------------

async def _fetch_clickpost(url: str, timeout_ms: int = 45000) -> Dict[str, Any]:
    """Load a ClickPost tracking page and capture its JSON tracking response."""
    from playwright.async_api import async_playwright

    captured: List[Dict[str, Any]] = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-blink-features=AutomationControlled",
                "--disable-dev-shm-usage",
            ],
        )
        try:
            context = await browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                ),
                viewport={"width": 1280, "height": 900},
            )
            page = await context.new_page()

            async def handle_response(resp):
                try:
                    if "/api/tracking" in resp.url:
                        ct = resp.headers.get("content-type", "")
                        if "json" in ct:
                            body = await resp.json()
                            captured.append(body)
                except Exception:
                    pass

            page.on("response", handle_response)
            await page.goto(url, wait_until="networkidle", timeout=timeout_ms)
            # Give the page a beat in case of late XHR
            await asyncio.sleep(2)
        finally:
            await browser.close()

    if not captured:
        raise RuntimeError("No tracking JSON captured from ClickPost page")

    return captured[-1]  # last response is most complete


def _parse_clickpost_payload(payload: Dict[str, Any], waybill: Optional[str]) -> Dict[str, Any]:
    """Flatten the ClickPost JSON into our normalized shape."""
    result = (payload or {}).get("data", {}).get("result", {})
    if not result:
        raise RuntimeError("Empty ClickPost result")

    cp_name = result.get("cp_name") or "Unknown"
    wb = waybill or result.get("waybill")
    block = result.get(wb) if wb else {}
    if not isinstance(block, dict):
        block = {}
    scans = block.get("scans") or []

    # Sort scans by timestamp ASC for clean timeline
    def _ts(s):
        try:
            return s.get("timestamp") or ""
        except Exception:
            return ""

    scans_sorted = sorted([s for s in scans if isinstance(s, dict)], key=_ts)

    events = []
    for s in scans_sorted:
        events.append({
            "timestamp": s.get("timestamp"),
            "location": s.get("location") or "",
            "remark": s.get("remark") or "",
            "raw_status": s.get("status") or "",
            "bucket": s.get("clickpost_status_bucket"),
            "bucket_description": s.get("clickpost_status_bucket_description") or "",
        })

    latest = scans_sorted[-1] if scans_sorted else {}
    bucket = latest.get("clickpost_status_bucket")
    status = CLICKPOST_BUCKET_TO_STATUS.get(bucket, "In Transit" if events else "Pending")

    last_event_at = latest.get("timestamp") if latest else None

    return {
        "carrier": cp_name,
        "waybill": wb,
        "status": status,
        "current_location": latest.get("location") or "",
        "last_event": latest.get("remark") or latest.get("clickpost_status_bucket_description") or "",
        "last_event_at": last_event_at,
        "events": events,
        "raw": result,
    }


# ---------------- Public API ----------------

async def fetch_delivery_status(url: str) -> Dict[str, Any]:
    """Fetch + normalize delivery status for any supported carrier URL."""
    if not url:
        raise ValueError("Tracking URL is required")

    carrier = detect_carrier(url)
    waybill = extract_waybill(url)

    if carrier in ("ClickPost", "1mg"):
        payload = await _fetch_clickpost(url)
        parsed = _parse_clickpost_payload(payload, waybill)
        parsed["fetched_at"] = datetime.now(timezone.utc).isoformat()
        return parsed

    raise NotImplementedError(f"Carrier '{carrier}' not yet supported")


def compute_flags(status: str, last_event_at: Optional[str]) -> Tuple[bool, bool]:
    """Return (is_stuck, is_delayed).

    Stuck = non-terminal status and no event update in the last 48 hours.
    Delayed: not implemented in v1 (no reliable ETA from ClickPost).
    """
    if status in TERMINAL_STATUSES or not last_event_at:
        return (False, False)
    try:
        # ClickPost timestamps are naive IST-ish - we treat them as UTC since
        # all we care about is delta. (Off-by-5h max; doesn't affect 48h threshold.)
        ts = datetime.fromisoformat(last_event_at.replace("Z", "+00:00"))
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
    except Exception:
        return (False, False)
    age_hours = (datetime.now(timezone.utc) - ts).total_seconds() / 3600.0
    return (age_hours >= 48.0, False)
