import os
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path

_data_dir = Path(os.environ.get("DATA_DIR", "data"))
_data_dir.mkdir(parents=True, exist_ok=True)
DB_PATH = _data_dir / "campsite.db"

def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_conn()
    c = conn.cursor()

    # ── Users ──────────────────────────────────────────────────────────────
    c.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            email         TEXT UNIQUE NOT NULL,
            name          TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            ntfy_topic    TEXT DEFAULT '',
            created_at    TEXT DEFAULT (datetime('now'))
        )
    """)

    # ── Per-user watches (replaces watches.json for multi-user) ────────────
    c.execute("""
        CREATE TABLE IF NOT EXISTS watches (
            id                INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            campground_id     TEXT NOT NULL,
            name              TEXT NOT NULL,
            dates             TEXT NOT NULL,
            min_nights        INTEGER DEFAULT 1,
            max_nights        INTEGER,
            date_combinations TEXT,
            patterns          TEXT,
            pattern           TEXT,
            search_location   TEXT DEFAULT '',
            min_stay_required INTEGER,
            created_at        TEXT DEFAULT (datetime('now'))
        )
    """)

    # ── Campgrounds — static metadata ──────────────────────────────────────
    c.execute("""
        CREATE TABLE IF NOT EXISTS campgrounds (
            id         TEXT PRIMARY KEY,
            name       TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now'))
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS sites (
            id            TEXT PRIMARY KEY,
            campground_id TEXT NOT NULL,
            site_name     TEXT,
            loop          TEXT,
            site_type     TEXT,
            FOREIGN KEY (campground_id) REFERENCES campgrounds(id)
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS availability_snapshots (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            campground_id TEXT NOT NULL,
            site_id       TEXT NOT NULL,
            date          TEXT NOT NULL,
            status        TEXT NOT NULL,
            polled_at     TEXT NOT NULL
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS state_transitions (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            campground_id   TEXT NOT NULL,
            site_id         TEXT NOT NULL,
            date            TEXT NOT NULL,
            from_status     TEXT NOT NULL,
            to_status       TEXT NOT NULL,
            detected_at     TEXT NOT NULL,
            days_before_trip INTEGER,
            hour_of_day     INTEGER,
            day_of_week     INTEGER
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS last_known_status (
            campground_id TEXT NOT NULL,
            site_id       TEXT NOT NULL,
            date          TEXT NOT NULL,
            status        TEXT NOT NULL,
            updated_at    TEXT NOT NULL,
            PRIMARY KEY (campground_id, site_id, date)
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
            token      TEXT PRIMARY KEY,
            user_id    INTEGER NOT NULL,
            expires_at TEXT NOT NULL,
            used       INTEGER DEFAULT 0
        )
    """)

    conn.commit()
    conn.close()
    print("[db] Database initialized ✓")


# ── User helpers ───────────────────────────────────────────────────────────

def create_user(email: str, name: str, password_hash: str) -> int:
    conn = get_conn()
    cur = conn.execute(
        "INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)",
        (email.lower(), name, password_hash)
    )
    user_id = cur.lastrowid
    conn.commit()
    conn.close()
    return user_id


def get_user_by_email(email: str):
    conn = get_conn()
    row = conn.execute("SELECT * FROM users WHERE email = ?", (email.lower(),)).fetchone()
    conn.close()
    return dict(row) if row else None


def get_user_by_id(user_id: int):
    conn = get_conn()
    row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def update_user_ntfy(user_id: int, ntfy_topic: str):
    conn = get_conn()
    conn.execute("UPDATE users SET ntfy_topic = ? WHERE id = ?", (ntfy_topic, user_id))
    conn.commit()
    conn.close()


# ── Watch helpers ──────────────────────────────────────────────────────────

def get_watches_for_user(user_id: int):
    import json
    conn = get_conn()
    rows = conn.execute(
        "SELECT * FROM watches WHERE user_id = ? ORDER BY created_at DESC", (user_id,)
    ).fetchall()
    conn.close()
    result = []
    for row in rows:
        w = dict(row)
        w["dates"] = json.loads(w["dates"]) if w["dates"] else []
        w["date_combinations"] = json.loads(w["date_combinations"]) if w.get("date_combinations") else None
        w["patterns"] = json.loads(w["patterns"]) if w.get("patterns") else None
        result.append(w)
    return result


def get_all_watches_with_users():
    """Used by the poller — returns every watch joined with its owner's contact info."""
    import json
    conn = get_conn()
    rows = conn.execute("""
        SELECT w.*, u.email AS user_email, u.name AS user_name, u.ntfy_topic AS user_ntfy_topic
        FROM watches w JOIN users u ON w.user_id = u.id
    """).fetchall()
    conn.close()
    result = []
    for row in rows:
        w = dict(row)
        w["dates"] = json.loads(w["dates"]) if w["dates"] else []
        w["date_combinations"] = json.loads(w["date_combinations"]) if w.get("date_combinations") else None
        w["patterns"] = json.loads(w["patterns"]) if w.get("patterns") else None
        result.append(w)
    return result


def add_watch(user_id: int, data: dict) -> int:
    import json
    conn = get_conn()
    cur = conn.execute("""
        INSERT INTO watches
            (user_id, campground_id, name, dates, min_nights, max_nights,
             date_combinations, patterns, pattern, search_location, min_stay_required)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        user_id,
        data["campground_id"],
        data["name"],
        json.dumps(data.get("dates", [])),
        data.get("min_nights", 1),
        data.get("max_nights"),
        json.dumps(data.get("date_combinations")) if data.get("date_combinations") else None,
        json.dumps(data.get("patterns")) if data.get("patterns") else None,
        data.get("pattern"),
        data.get("search_location", ""),
        data.get("min_stay_required"),
    ))
    watch_id = cur.lastrowid
    conn.commit()
    conn.close()
    return watch_id


def delete_watch(watch_id: int, user_id: int) -> bool:
    conn = get_conn()
    cur = conn.execute(
        "DELETE FROM watches WHERE id = ? AND user_id = ?", (watch_id, user_id)
    )
    conn.commit()
    conn.close()
    return cur.rowcount > 0


# ── Availability helpers (unchanged) ──────────────────────────────────────

def get_last_status(campground_id, site_id, date):
    conn = get_conn()
    row = conn.execute(
        "SELECT status FROM last_known_status WHERE campground_id=? AND site_id=? AND date=?",
        (campground_id, site_id, date)
    ).fetchone()
    conn.close()
    return row["status"] if row else None


def save_snapshot(campground_id, site_id, date, status, polled_at):
    conn = get_conn()
    conn.execute(
        "INSERT INTO availability_snapshots (campground_id, site_id, date, status, polled_at) VALUES (?,?,?,?,?)",
        (campground_id, site_id, date, status, polled_at)
    )
    conn.commit()
    conn.close()


def save_transition(campground_id, site_id, date, from_status, to_status, detected_at):
    now = datetime.fromisoformat(detected_at)
    from datetime import date as date_obj
    trip_date = date_obj.fromisoformat(date)
    days_before = (trip_date - now.date()).days
    conn = get_conn()
    conn.execute("""
        INSERT INTO state_transitions
        (campground_id, site_id, date, from_status, to_status, detected_at, days_before_trip, hour_of_day, day_of_week)
        VALUES (?,?,?,?,?,?,?,?,?)
    """, (
        campground_id, site_id, date, from_status, to_status, detected_at,
        days_before, now.hour, now.weekday()
    ))
    conn.commit()
    conn.close()


def update_user_name(user_id: int, name: str):
    conn = get_conn()
    conn.execute("UPDATE users SET name = ? WHERE id = ?", (name, user_id))
    conn.commit()
    conn.close()


def update_password(user_id: int, password_hash: str):
    conn = get_conn()
    conn.execute("UPDATE users SET password_hash = ? WHERE id = ?", (password_hash, user_id))
    conn.commit()
    conn.close()


def create_reset_token(user_id: int, token: str):
    expires_at = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
    conn = get_conn()
    conn.execute(
        "INSERT INTO password_reset_tokens (token, user_id, expires_at) VALUES (?, ?, ?)",
        (token, user_id, expires_at)
    )
    conn.commit()
    conn.close()


def use_reset_token(token: str):
    """Returns user_id if token is valid and unused, else None. Marks it used."""
    conn = get_conn()
    row = conn.execute(
        "SELECT user_id, expires_at, used FROM password_reset_tokens WHERE token = ?",
        (token,)
    ).fetchone()
    if not row or row["used"] or row["expires_at"] < datetime.now(timezone.utc).isoformat():
        conn.close()
        return None
    conn.execute("UPDATE password_reset_tokens SET used = 1 WHERE token = ?", (token,))
    conn.commit()
    user_id = row["user_id"]
    conn.close()
    return user_id


def update_last_status(campground_id, site_id, date, status, updated_at):
    conn = get_conn()
    conn.execute("""
        INSERT INTO last_known_status (campground_id, site_id, date, status, updated_at)
        VALUES (?,?,?,?,?)
        ON CONFLICT(campground_id, site_id, date) DO UPDATE SET
            status=excluded.status,
            updated_at=excluded.updated_at
    """, (campground_id, site_id, date, status, updated_at))
    conn.commit()
    conn.close()
