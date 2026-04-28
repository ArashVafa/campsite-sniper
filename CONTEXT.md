# Campsite Sniper — Project Context

> If chat history is lost, share this file with Claude to resume work seamlessly.

---

## What This Is

**Campsite Sniper** monitors Recreation.gov for campsite availability and alerts users in real-time via email and ntfy.sh push notifications. It helps users secure campsites during peak seasons by detecting when sites open up.

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
| `notifier.py` | Email + ntfy.sh notification dispatch, password reset emails |
| `config.py` | Reads all config from environment variables |
| `frontend/src/App.jsx` | Entire React SPA (auth, watches, campground search, dashboard) |
| `start.sh` | Starts poller in background + uvicorn in foreground (used by Render) |
| `render.yaml` | Render service config — persistent disk, env vars, build/start commands |
| `DEPLOY.md` | Full step-by-step deployment and ops manual |

---

## Live Deployment

- **URL:** https://campsite-sniper.onrender.com
- **Platform:** Render Web Service (Starter plan, $7/mo)
- **Architecture:** Single service runs both `uvicorn` (web) and `poller.py` (background) via `start.sh`
- **Database:** SQLite at `/data/campsite.db` on a Render persistent disk (1 GB)
- **Deploy process:** `git push origin main` → Render auto-deploys
- **Env vars:** Set in Render dashboard (see DEPLOY.md for full list)

---

## Features Implemented

- **Multi-user auth** — register, login, JWT tokens (30-day expiry), PBKDF2-SHA256 password hashing
- **Forgot password** — email reset link (1-hour expiry, single-use token), `/reset?token=...` flow in UI
- **Watch management** — create/delete watches scoped per user
- **Date patterns** — explicit stay patterns: Fri+Sat, Sat+Sun, Fri+Sat+Sun, weekdays, consecutive, exact dates. Selecting a pattern auto-sets min/max nights.
- **Campground search** — Nominatim geocoding + RIDB API, radius filtering (10/25/50/100 mi)
- **Polling** — Recreation.gov availability calendar API, detects Reserved→Available transitions every 5 min
- **Notifications** — email + ntfy.sh per user, with direct booking links
- **Dashboard** — stats (snapshots, openings found, last poll in PST), active watches, recent availability alerts
- **Availability feed** — shows campground name, site, date, and detected time (PST). Stale entries (>7 days) are hidden.
- **Profile management** — update ntfy.sh topic

---

## Important Implementation Details

### Date Patterns
Patterns are defined in `api.py` (`PATTERN_DAYS` dict) and `frontend/src/App.jsx` (`PATTERNS` array).
Each pattern has a fixed `nights` value that auto-sets min/max nights when selected.

| Pattern key | Nights | Check-in days (weekday index) |
|-------------|--------|-------------------------------|
| `fri_sat` | 2 | Fri(4) + Sat(5) → out Sunday |
| `sat_sun` | 2 | Sat(5) + Sun(6) → out Monday |
| `fri_sat_sun` | 3 | Fri(4) + Sat(5) + Sun(6) → out Monday |
| `weekdays_only` | variable | Mon(0)–Thu(3) |
| `any_consecutive` | variable | Any |
| `exact` | — | Manual date entry |

Legacy keys (`summer_weekends`, `any_weekend`, `weekend_friday`) are kept as aliases in the backend for existing watches.

### Campground Names in Activity Feed
The `campgrounds` table is never populated. Campground names are stored in the `watches` table.
The `/api/activity` endpoint uses a subquery against `watches` to resolve names.

### Passwords
Stored as `PBKDF2-SHA256` with a random salt and 200k iterations. Never stored in plaintext. No changes needed.

### API URL (frontend)
`const API = import.meta.env.VITE_API_URL || ""`
Since FastAPI serves the React SPA, all API calls use relative paths in production.
Set `VITE_API_URL=http://localhost:8000` in `.env` only for local dev if running frontend separately.

### Timezone
All timestamps stored as ISO strings (UTC on Render). The `toPST()` helper in `App.jsx` converts to PST for display.

---

## Known Gaps / Planned Features

- [ ] SMS notifications — Twilio configured in `config.py` but not wired in `notifier.py`
- [ ] Pause/resume watches (currently only create/delete)
- [ ] Watch editing (must delete and recreate to change dates/pattern)
- [ ] Mobile-responsive UI (hardcoded pixel values throughout)
- [ ] Rate limiting on API endpoints
- [ ] Database cleanup/archival for growing `availability_snapshots` table
- [ ] Watch sharing between users
- [ ] Email verification on signup (low priority for alpha)
- [ ] Notification history UI (feed already exists, but no per-user scoping of past alerts beyond 7 days)

---

## Completed Work Log

1. **Initial MVP** — polling, detection, notifications, multi-user auth, dashboard
2. **Secrets** — moved from hardcoded `config.py` to environment variables
3. **Render deployment** — `render.yaml`, `start.sh`, persistent disk at `/data`, `DEPLOY.md`
4. **Fixed API URL** — was hardcoded to `localhost:8000`; changed to relative paths
5. **Date pattern redesign** — replaced vague patterns with explicit Fri+Sat / Sat+Sun / Fri+Sat+Sun; auto-sets nights
6. **Campground names** — fixed activity feed to show names (subquery against watches table)
7. **Staleness filter** — activity feed hides alerts older than 7 days
8. **Renamed cancellations → availability** — throughout UI and email notifications
9. **PST timestamps** — last poll and detected-at times displayed in PST
10. **Forgot password** — full email reset flow with 1-hour expiry tokens

---

## How to Run Locally

```bash
# Backend
source venv/bin/activate
cp .env.example .env        # fill in your keys
python api.py               # FastAPI server on :8000
python poller.py            # Background poller (separate terminal)

# Frontend (dev server)
cd frontend
npm install
npm run dev                 # Vite on :5173

# Frontend (build for production)
npm run build               # outputs to frontend/dist/, served by FastAPI
```
