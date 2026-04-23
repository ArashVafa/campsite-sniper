import base64
import hashlib
import hmac
import json
import math
import os
import time
import requests as req_lib
from datetime import date as date_obj, timedelta
from pathlib import Path
from typing import List, Optional

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

import db
from config import RIDB_API_KEY, SECRET_KEY, FRONTEND_ORIGIN

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN, "http://localhost:5173", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

RIDB_BASE = "https://ridb.recreation.gov/api/v1"

# ── Password & token helpers ───────────────────────────────────────────────

def hash_password(password: str) -> str:
    salt = os.urandom(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 200_000)
    return salt.hex() + ":" + key.hex()


def verify_password(password: str, stored: str) -> bool:
    try:
        salt_hex, key_hex = stored.split(":")
        salt = bytes.fromhex(salt_hex)
        key = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 200_000)
        return hmac.compare_digest(key.hex(), key_hex)
    except Exception:
        return False


def create_token(user_id: int, email: str) -> str:
    payload = json.dumps({"user_id": user_id, "email": email, "exp": time.time() + 86400 * 30})
    b64 = base64.urlsafe_b64encode(payload.encode()).decode()
    sig = hmac.new(SECRET_KEY.encode(), b64.encode(), hashlib.sha256).hexdigest()
    return f"{b64}.{sig}"


def verify_token(token: str) -> Optional[dict]:
    try:
        b64, sig = token.rsplit(".", 1)
        expected = hmac.new(SECRET_KEY.encode(), b64.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected):
            return None
        payload = json.loads(base64.urlsafe_b64decode(b64).decode())
        if payload["exp"] < time.time():
            return None
        return payload
    except Exception:
        return None


def get_current_user(authorization: str = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = verify_token(authorization[7:])
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return payload


# ── Auth models ────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: str
    name: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

class UpdateProfileRequest(BaseModel):
    ntfy_topic: Optional[str] = None


# ── Watch model ────────────────────────────────────────────────────────────

class WatchRequest(BaseModel):
    campground_id: str
    name: str
    dates: List[str]
    min_nights: int = 1
    max_nights: Optional[int] = None
    date_combinations: Optional[List[List[str]]] = None
    patterns: Optional[List[str]] = None
    pattern: Optional[str] = None
    search_location: Optional[str] = None
    min_stay_required: Optional[int] = None


class DateExpandRequest(BaseModel):
    start: str
    end: str
    pattern: str
    min_nights: int = 1
    max_nights: Optional[int] = None


# ── Auth endpoints ─────────────────────────────────────────────────────────

@app.post("/api/auth/register")
def register(req: RegisterRequest):
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    if not req.email or "@" not in req.email:
        raise HTTPException(status_code=400, detail="Invalid email")
    if db.get_user_by_email(req.email):
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = db.create_user(req.email, req.name, hash_password(req.password))
    token = create_token(user_id, req.email.lower())
    return {"token": token, "user": {"id": user_id, "email": req.email.lower(), "name": req.name}}


@app.post("/api/auth/login")
def login(req: LoginRequest):
    user = db.get_user_by_email(req.email)
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_token(user["id"], user["email"])
    return {"token": token, "user": {"id": user["id"], "email": user["email"], "name": user["name"]}}


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/auth/me")
def me(current_user: dict = Depends(get_current_user)):
    user = db.get_user_by_id(current_user["user_id"])
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"id": user["id"], "email": user["email"], "name": user["name"], "ntfy_topic": user.get("ntfy_topic", "")}


@app.patch("/api/auth/profile")
def update_profile(req: UpdateProfileRequest, current_user: dict = Depends(get_current_user)):
    if req.ntfy_topic is not None:
        db.update_user_ntfy(current_user["user_id"], req.ntfy_topic)
    return {"ok": True}


# ── Watch endpoints (user-scoped) ──────────────────────────────────────────

@app.get("/api/watches")
def get_watches(current_user: dict = Depends(get_current_user)):
    return db.get_watches_for_user(current_user["user_id"])


@app.post("/api/watches")
def add_watch(watch: WatchRequest, current_user: dict = Depends(get_current_user)):
    watch_id = db.add_watch(current_user["user_id"], watch.dict())
    return {"ok": True, "id": watch_id}


@app.delete("/api/watches/{watch_id}")
def remove_watch(watch_id: int, current_user: dict = Depends(get_current_user)):
    if not db.delete_watch(watch_id, current_user["user_id"]):
        raise HTTPException(status_code=404, detail="Watch not found")
    return {"ok": True}


# ── Activity / stats (user-scoped where applicable) ────────────────────────

@app.get("/api/activity")
def get_activity(limit: int = 20, current_user: dict = Depends(get_current_user)):
    # Show activity only for this user's campground IDs
    watches = db.get_watches_for_user(current_user["user_id"])
    cg_ids = list({w["campground_id"] for w in watches})
    if not cg_ids:
        return []
    conn = db.get_conn()
    placeholders = ",".join("?" * len(cg_ids))
    rows = conn.execute(f"""
        SELECT campground_id, site_id, date, from_status, to_status, detected_at
        FROM state_transitions
        WHERE to_status = 'Available' AND campground_id IN ({placeholders})
        ORDER BY detected_at DESC
        LIMIT ?
    """, cg_ids + [limit]).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.get("/api/status/{campground_id}")
def get_status(campground_id: str, current_user: dict = Depends(get_current_user)):
    conn = db.get_conn()
    rows = conn.execute("""
        SELECT site_id, date, status, updated_at
        FROM last_known_status
        WHERE campground_id = ?
        ORDER BY date, site_id
    """, (campground_id,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.get("/api/stats")
def get_stats(current_user: dict = Depends(get_current_user)):
    conn = db.get_conn()
    total_snapshots = conn.execute("SELECT COUNT(*) FROM availability_snapshots").fetchone()[0]
    total_cancellations = conn.execute(
        "SELECT COUNT(*) FROM state_transitions WHERE to_status='Available'"
    ).fetchone()[0]
    last_poll = conn.execute("SELECT MAX(polled_at) FROM availability_snapshots").fetchone()[0]
    conn.close()
    return {"total_snapshots": total_snapshots, "total_cancellations": total_cancellations, "last_poll": last_poll}


# ── Campground search ──────────────────────────────────────────────────────

def haversine(lat1, lon1, lat2, lon2):
    R = 3958.8
    lat1, lon1, lat2, lon2 = map(math.radians, [float(lat1), float(lon1), float(lat2), float(lon2)])
    dlat, dlon = lat2 - lat1, lon2 - lon1
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return round(2 * R * math.asin(math.sqrt(a)), 1)


@app.get("/api/campgrounds/search")
def search_campgrounds(q: str, radius: int = 50, current_user: dict = Depends(get_current_user)):
    try:
        geo_resp = req_lib.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": q, "format": "json", "limit": 1, "addressdetails": 1},
            headers={"User-Agent": "CampsiteSniper/1.0"},
            timeout=10,
        )
        geo_data = geo_resp.json()
    except Exception as e:
        return {"error": f"Geocoding failed: {e}", "results": []}

    if not geo_data:
        return {"error": "Location not found", "results": []}

    lat = float(geo_data[0]["lat"])
    lon = float(geo_data[0]["lon"])
    display_name = geo_data[0].get("display_name", q)
    addr = geo_data[0].get("address", {})
    city_name = addr.get("city") or addr.get("town") or addr.get("village") or addr.get("county", "")
    state_name = addr.get("state", "")
    county_name = addr.get("county", "").replace(" County", "").replace(" Parish", "")

    if RIDB_API_KEY and RIDB_API_KEY != "your-ridb-api-key-here":
        try:
            ridb_resp = req_lib.get(
                f"{RIDB_BASE}/facilities",
                params={"latitude": lat, "longitude": lon, "radius": radius, "activity": "CAMPING", "apikey": RIDB_API_KEY, "limit": 50},
                timeout=15,
            )
            if ridb_resp.status_code == 200:
                ridb_data = ridb_resp.json()
                results = []
                for f in ridb_data.get("RECDATA", []):
                    fac_lat, fac_lon = f.get("FacilityLatitude"), f.get("FacilityLongitude")
                    distance = haversine(lat, lon, fac_lat, fac_lon) if fac_lat and fac_lon else None
                    addrs = f.get("FACILITYADDRESS", [])
                    city = addrs[0].get("City", "") if addrs else ""
                    state = addrs[0].get("AddressStateCode", "") if addrs else ""
                    results.append({"id": str(f.get("FacilityID")), "name": f.get("FacilityName", "").strip(), "distance": distance, "city": city, "state": state})
                results.sort(key=lambda x: x["distance"] if x["distance"] is not None else 9999)
                return {"lat": lat, "lon": lon, "location": display_name, "results": results}
        except Exception:
            pass

    queries = []
    if city_name and state_name:
        queries.append(f"{city_name} {state_name}")
    if county_name and state_name and county_name != city_name:
        queries.append(f"{county_name} {state_name}")
    if state_name:
        queries.append(state_name)

    headers = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}
    seen_ids: set = set()
    results = []
    for query in queries:
        try:
            resp = req_lib.get("https://www.recreation.gov/api/search", params={"q": query, "entity_type": "campground", "size": 100}, headers=headers, timeout=15)
            data = resp.json()
        except Exception:
            continue
        for facility in data.get("results", []):
            if facility.get("entity_type") != "campground":
                continue
            fac_lat, fac_lon = facility.get("latitude"), facility.get("longitude")
            if not fac_lat or not fac_lon:
                continue
            try:
                distance = haversine(lat, lon, fac_lat, fac_lon)
            except Exception:
                continue
            if distance > radius:
                continue
            fac_id = str(facility.get("entity_id", facility.get("id", "")))
            if fac_id in seen_ids:
                continue
            seen_ids.add(fac_id)
            results.append({"id": fac_id, "name": facility.get("name", "").strip(), "distance": distance, "city": facility.get("city", ""), "state": ""})
        if len(results) >= 10:
            break

    results.sort(key=lambda x: x["distance"])
    return {"lat": lat, "lon": lon, "location": display_name, "results": results}


@app.get("/api/campgrounds/{facility_id}/attributes")
def get_facility_attributes(facility_id: str, current_user: dict = Depends(get_current_user)):
    try:
        resp = req_lib.get(f"{RIDB_BASE}/facilities/{facility_id}/attributes", params={"apikey": RIDB_API_KEY}, timeout=10)
        data = resp.json()
    except Exception:
        return {"min_stay": 1}
    min_stay = 1
    for attr in data.get("RECDATA", []):
        attr_name = attr.get("AttributeName", "").lower()
        if "min" in attr_name and ("stay" in attr_name or "night" in attr_name):
            try:
                val = int(float(attr.get("AttributeValue", 1)))
                if val > min_stay:
                    min_stay = val
            except Exception:
                pass
    return {"min_stay": min_stay}


# ── Date expansion ─────────────────────────────────────────────────────────

@app.post("/api/dates/expand")
def expand_dates(req: DateExpandRequest):
    if req.pattern == "exact":
        return {"combinations": [], "all_dates": [], "total_combinations": 0, "total_dates": 0}

    start = date_obj.fromisoformat(req.start)
    end = date_obj.fromisoformat(req.end)
    min_n = max(1, req.min_nights)
    max_n = req.max_nights if req.max_nights else min_n

    PATTERN_DAYS = {
        "summer_weekends": {4, 5},
        "any_weekend":     {4, 5},   # Fri+Sat check-in nights (check in Fri, checkout Sun)
        "weekend_friday":  {3, 4, 5},  # Thu+Fri+Sat (extended weekend, checkout Sun)
        "weekdays_only":   {0, 1, 2, 3},
        "any_consecutive": {0, 1, 2, 3, 4, 5, 6},
    }
    allowed = PATTERN_DAYS.get(req.pattern, {0, 1, 2, 3, 4, 5, 6})

    nights = []
    d = start
    while d < end:
        if d.weekday() in allowed:
            nights.append(d)
        d += timedelta(days=1)

    if not nights:
        return {"combinations": [], "all_dates": [], "total_combinations": 0, "total_dates": 0}

    groups = [[nights[0]]]
    for i in range(1, len(nights)):
        if (nights[i] - nights[i - 1]).days == 1:
            groups[-1].append(nights[i])
        else:
            groups.append([nights[i]])

    combinations = []
    for group in groups:
        n = len(group)
        for s in range(n):
            for length in range(min_n, max_n + 1):
                if s + length > n:
                    break
                combinations.append([d.isoformat() for d in group[s: s + length]])

    all_dates = sorted(set(d for combo in combinations for d in combo))
    return {"combinations": combinations, "all_dates": all_dates, "total_combinations": len(combinations), "total_dates": len(all_dates)}


# ── Startup: ensure DB is ready ────────────────────────────────────────────

@app.on_event("startup")
def startup():
    db.init_db()


# ── Serve React frontend (production build) ────────────────────────────────

FRONTEND_DIST = Path(__file__).parent / "frontend" / "dist"

if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

@app.get("/{full_path:path}", include_in_schema=False)
def serve_frontend(full_path: str):
    if not FRONTEND_DIST.exists():
        return {"status": "ok", "message": "Campsite Sniper API is running"}
    file = FRONTEND_DIST / full_path
    if file.exists() and file.is_file():
        return FileResponse(file)
    return FileResponse(FRONTEND_DIST / "index.html")
