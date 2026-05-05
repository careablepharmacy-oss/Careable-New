"""Medicine Intelligence Service — Gemini-powered disease + product detection.

Credit-efficient design:
  • Cache key = normalized medicine name (lowercase, trimmed).
  • ONE Gemini call per unique medicine name across the entire app.
  • Subsequent requests for the same medicine (from any patient) hit the cache.
  • Cache never expires automatically; admin can clear via /api/crm/medicine-intel/cache (future).
  • Uses gemini-2.5-flash-lite for lowest cost.

Result shape (stored in db.crm_medicine_intel):
  {
    normalized_name, original_query, generic_name, brand_names[], drug_class,
    diseases: [
      {
        name, description,
        medical_equipment: [{name, purpose}],
        personal_care: [{name, purpose}],
      }
    ],
    cached_at,
    source: "gemini"
  }
"""
import os
import json
import uuid
import logging
import asyncio
from datetime import datetime, timezone
from typing import Optional, Dict, List

logger = logging.getLogger(__name__)

_db = None
_inflight: Dict[str, asyncio.Task] = {}   # dedupe concurrent calls for the same medicine


def set_db(database):
    global _db
    _db = database


def _normalize(name: str) -> str:
    return (name or "").strip().lower()


SYSTEM_MSG = (
    "You are a medical information assistant. You output ONLY valid compact JSON. "
    "No markdown fences, no prose."
)

PROMPT_TPL = """For the medicine "{name}" return compact JSON only, no markdown:
{{
 "generic_name": "...|null",
 "brand_names": ["..."],
 "drug_class": "...|null",
 "diseases": [
   {{
     "name": "Condition name",
     "description": "One short line, <=20 words",
     "medical_equipment": [{{"name":"...","purpose":"short","price_inr":1200}}],
     "personal_care": [{{"name":"...","purpose":"short","price_inr":450}}]
   }}
 ]
}}
Rules:
- 2-4 diseases most commonly treated.
- 1-2 equipment items per disease (e.g. BP monitor, glucometer).
- 1-2 personal care products per disease (e.g. compression socks, moisturizer). NO medicines.
- price_inr: typical retail price in Indian Rupees (integer). Rough estimate is fine.
- If medicine unknown, return {{"generic_name":null,"brand_names":[],"drug_class":null,"diseases":[]}}"""


def _cache_is_stale(doc: Optional[Dict]) -> bool:
    """Treat cached docs without price_inr on equipment as stale (pre-v2 schema)."""
    if not doc:
        return True
    diseases = doc.get("diseases") or []
    if not diseases:
        return False
    for d in diseases:
        equip = d.get("medical_equipment") or []
        if equip and all(("price_inr" not in e) for e in equip):
            return True
    return False


async def get_cached(name: str) -> Optional[Dict]:
    if _db is None:
        return None
    n = _normalize(name)
    if not n:
        return None
    doc = await _db.crm_medicine_intel.find_one({"normalized_name": n}, {"_id": 0})
    return doc


async def _call_gemini(name: str) -> Optional[Dict]:
    """Single-shot Gemini call. Returns parsed dict or None on failure."""
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        logger.warning("[MedicineIntel] EMERGENT_LLM_KEY missing; skipping LLM call")
        return None
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
    except ImportError as e:
        logger.warning(f"[MedicineIntel] emergentintegrations not installed: {e}")
        return None

    try:
        chat = LlmChat(
            api_key=api_key,
            session_id=f"med-intel-{uuid.uuid4().hex[:8]}",
            system_message=SYSTEM_MSG,
        ).with_model("gemini", "gemini-2.5-flash")

        resp = await chat.send_message(UserMessage(text=PROMPT_TPL.format(name=name)))
        resp = (resp or "").strip()
        # strip code fences if present
        if resp.startswith("```json"):
            resp = resp[7:]
        if resp.startswith("```"):
            resp = resp[3:]
        if resp.endswith("```"):
            resp = resp[:-3]
        resp = resp.strip()
        return json.loads(resp)
    except Exception as e:
        logger.warning(f"[MedicineIntel] Gemini call failed for '{name}': {e}")
        return None


async def detect_for_medicine(name: str, force_refresh: bool = False) -> Optional[Dict]:
    """Return a medicine intel document. Uses cache unless force_refresh=True.
    Dedupes concurrent requests for the same medicine."""
    if not name:
        return None
    n = _normalize(name)

    if not force_refresh:
        cached = await get_cached(n)
        if cached and not _cache_is_stale(cached):
            return cached

    # In-flight dedupe (prevents 2 callers kicking off 2 Gemini calls for same medicine)
    if n in _inflight:
        try:
            return await _inflight[n]
        except Exception:
            pass

    async def _runner():
        data = await _call_gemini(name)
        if not data:
            return None
        doc = {
            "normalized_name": n,
            "original_query": name,
            "generic_name": data.get("generic_name"),
            "brand_names": data.get("brand_names") or [],
            "drug_class": data.get("drug_class"),
            "diseases": data.get("diseases") or [],
            "cached_at": datetime.now(timezone.utc).isoformat(),
            "source": "gemini",
        }
        try:
            await _db.crm_medicine_intel.update_one(
                {"normalized_name": n},
                {"$set": doc},
                upsert=True,
            )
        except Exception as e:
            logger.warning(f"[MedicineIntel] cache write failed: {e}")
        return doc

    task = asyncio.create_task(_runner())
    _inflight[n] = task
    try:
        return await task
    finally:
        _inflight.pop(n, None)


async def aggregate_for_medicines(medicine_names: List[str]) -> Dict:
    """Aggregate diseases + product suggestions across a list of medicines using ONLY cache.
    Never triggers a Gemini call (caller schedules warming separately via warm_cache_for_medicines).

    Returns: {diseases: [{name, description, from_medicines[]}],
              medical_equipment: [...], personal_care: [...]}
    """
    if not medicine_names or _db is None:
        return {"diseases": [], "medical_equipment": [], "personal_care": []}

    normalized = [_normalize(m) for m in medicine_names if m]
    if not normalized:
        return {"diseases": [], "medical_equipment": [], "personal_care": []}

    docs = await _db.crm_medicine_intel.find(
        {"normalized_name": {"$in": normalized}}, {"_id": 0}
    ).to_list(len(normalized))

    diseases_by_name: Dict[str, Dict] = {}
    equipment_by_name: Dict[str, Dict] = {}
    personal_by_name: Dict[str, Dict] = {}

    for doc in docs:
        src_med = doc.get("original_query") or doc.get("normalized_name")
        for d in doc.get("diseases", []):
            dn = (d.get("name") or "").strip()
            if not dn:
                continue
            key = dn.lower()
            if key not in diseases_by_name:
                diseases_by_name[key] = {
                    "name": dn,
                    "description": d.get("description") or "",
                    "from_medicines": [src_med],
                }
            elif src_med and src_med not in diseases_by_name[key]["from_medicines"]:
                diseases_by_name[key]["from_medicines"].append(src_med)

            for eq in d.get("medical_equipment") or []:
                en = (eq.get("name") or "").strip()
                if not en:
                    continue
                k = en.lower()
                if k not in equipment_by_name:
                    equipment_by_name[k] = {
                        "name": en,
                        "purpose": eq.get("purpose") or "",
                        "price_inr": eq.get("price_inr"),
                        "for_diseases": [dn],
                    }
                elif dn not in equipment_by_name[k]["for_diseases"]:
                    equipment_by_name[k]["for_diseases"].append(dn)

            for pc in d.get("personal_care") or []:
                pn = (pc.get("name") or "").strip()
                if not pn:
                    continue
                k = pn.lower()
                if k not in personal_by_name:
                    personal_by_name[k] = {
                        "name": pn,
                        "purpose": pc.get("purpose") or "",
                        "price_inr": pc.get("price_inr"),
                        "for_diseases": [dn],
                    }
                elif dn not in personal_by_name[k]["for_diseases"]:
                    personal_by_name[k]["for_diseases"].append(dn)

    return {
        "diseases": list(diseases_by_name.values()),
        "medical_equipment": list(equipment_by_name.values()),
        "personal_care": list(personal_by_name.values()),
    }


async def warm_cache_for_medicines(medicine_names: List[str]) -> int:
    """Fire-and-forget warming: ensure each medicine has a cached intel doc.
    Returns number of new Gemini calls triggered.
    """
    if not medicine_names or _db is None:
        return 0
    normalized = list({_normalize(m) for m in medicine_names if m})

    # Find which are already cached (and have fresh schema)
    cached_docs = await _db.crm_medicine_intel.find(
        {"normalized_name": {"$in": normalized}}, {"_id": 0}
    ).to_list(len(normalized))
    fresh_set = {d["normalized_name"] for d in cached_docs if not _cache_is_stale(d)}
    to_fetch = [m for m in medicine_names if _normalize(m) not in fresh_set]

    calls = 0
    for m in to_fetch:
        # Sequential to keep traffic low — one call at a time
        await detect_for_medicine(m)
        calls += 1
    return calls
