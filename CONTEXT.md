# Campsite Sniper — Project Context

> If chat history is lost, share this file with Claude to resume work seamlessly.

---

## What This Is

**Campsite Sniper** monitors Recreation.gov for campsite cancellations and alerts users in real-time via email and ntfy.sh push notifications. It helps users secure campsites during peak seasons by detecting when reserved spots are released.

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Backend | FastAPI (Python), SQLite, `schedule` for polling |
| Frontend | React 19 + Vite, single `App.jsx`, Axios |
| Notifications | Gmail SMTP + ntfy.sh |
| Auth | JWT-like tokens, PBKDF2-SHA256 password hashing |

---

## Key Files

| File | Role |
|------|------|
| `api.py` | All FastAPI HTTP endpoints |
| `db.py` | SQLite schema and CRUD operations |
| `poller.py` | Background polling daemon (every 5 min) |
| `notifier.py` | Email + ntfy.sh notification dispatch |
| `config.py` | API keys, poll interval, SMTP credentials (hardcoded — not env vars yet) |
| `frontend/src/App.jsx` | Entire React SPA (auth, watches, campground search, dashboard) |
| `data/campsite.db` | SQLite database |

---

## Features Implemented

- **Multi-user auth** — register, login, JWT tokens (30-day expiry), PBKDF2 password hashing
- **Watch management** — create/delete watches scoped per user
- **Flexible date patterns** — weekends, weekdays, consecutive nights, exact dates, or hybrid
- **Campground search** — Nominatim geocoding + RIDB API, radius filtering (10/25/50/100 mi)
- **Polling** — Recreation.gov availability calendar API, detects Reserved→Available transitions
- **Notifications** — email + ntfy.sh per user, with booking links
- **Dashboard** — stats, active watches list, recent cancellations feed
- **Profile management** — update name, ntfy.sh topic

---

## Known Gaps / Planned Features

- [ ] SMS notifications — Twilio is configured in `config.py` but not wired in `notifier.py`
- [ ] Password reset flow
- [ ] Pause/resume watches (currently only create/delete)
- [ ] Watch editing (currently must delete and recreate)
- [ ] Mobile-responsive UI (hardcoded pixel values throughout)
- [ ] Rate limiting on API endpoints
- [ ] Database cleanup/archival for growing `availability_snapshots` table
- [x] Move secrets from `config.py` to environment variables
- [ ] Notification history (users can't see past alerts)
- [ ] Watch sharing between users

---

## Completed Work

- Initial MVP: polling, detection, notifications, multi-user auth, dashboard
- **Render deployment (current target):**
  - Both web server and poller run in a single Render Web Service via `start.sh`
  - SQLite database lives on a Render persistent disk mounted at `/DATA_DIR` (`/data`)
  - `db.py` reads `DATA_DIR` env var so DB path works locally (`data/`) and on Render (`/data/`)
  - `render.yaml` defines the full service config — one `git push` deploys everything
  - `/api/health` endpoint added for Render health checks
  - See `DEPLOY.md` for the full step-by-step deployment guide
  - Railway was attempted but abandoned — its shared-disk model doesn't fit SQLite + 2 processes

---

## How to Run

```bash
# Backend
source venv/bin/activate
python api.py        # FastAPI server
python poller.py     # Background poller (run separately)

# Frontend
cd frontend
npm run dev
```
