# Campsite Sniper — Deployment Manual

This app runs as a **single Render Web Service** that starts both the FastAPI web server
and the background poller in one process group. They share a persistent disk where the
SQLite database lives. No separate worker service needed.

---

## Architecture on Render

```
Render Web Service (campsite-sniper)
├── uvicorn api:app          ← serves the React SPA + all /api/* routes
├── python poller.py &       ← background daemon, polls every 5 min
└── Persistent Disk /data    ← campsite.db lives here, survives deploys
```

---

## One-time Setup

### 1. Push the repo to GitHub

```bash
cd campsite-sniper
git init
git add .
git commit -m "initial commit"
# create a new repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/campsite-sniper.git
git push -u origin main
```

### 2. Create a Render account

Sign up at https://render.com — free account works for setup.

### 3. Connect your GitHub repo

- Render Dashboard → **New** → **Web Service**
- Connect your GitHub account if prompted
- Select the `campsite-sniper` repository

### 4. Configure the service

Render will detect `render.yaml` automatically. Review the settings:

| Field | Value |
|-------|-------|
| Name | campsite-sniper |
| Runtime | Python |
| Build Command | `pip install -r requirements.txt && npm install --prefix frontend && npm run build --prefix frontend` |
| Start Command | `bash start.sh` |
| Plan | **Starter ($7/mo)** — required for persistent disk |

> **Free tier note:** The free tier does NOT support persistent disks. Your database will
> be wiped on every deploy. Use it only to verify the build works, then upgrade to Starter
> before sharing with users.

### 5. Add environment variables

After the service is created, go to **Environment** tab and fill in:

| Variable | Value | Notes |
|----------|-------|-------|
| `FRONTEND_ORIGIN` | `https://campsite-sniper.onrender.com` | Your actual Render URL |
| `RIDB_API_KEY` | your key | From recreation.gov developer portal |
| `EMAIL_FROM` | your Gmail address | e.g. `you@gmail.com` |
| `EMAIL_APP_PASSWORD` | Gmail app password | Not your login password — see below |
| `NTFY_TOPIC` | your ntfy.sh topic | e.g. `campsite-sniper-alerts` |
| `DATA_DIR` | `/data` | Already set in render.yaml |
| `SECRET_KEY` | auto-generated | Render generates this automatically |
| `POLL_INTERVAL_MINUTES` | `5` | Already set in render.yaml |

> **Gmail App Password:** Go to myaccount.google.com → Security → 2-Step Verification →
> App passwords → create one named "campsite-sniper". Use that 16-char password, not your
> Gmail login password.

### 6. Deploy

Click **Deploy** (or push any commit — Render auto-deploys on every push to `main`).

Watch the build logs. A successful deploy ends with:
```
[start] Launching poller in background...
[start] Poller PID: 12
[start] Starting web server...
INFO: Uvicorn running on http://0.0.0.0:10000
```

### 7. Get your public URL

Render assigns a URL like `https://campsite-sniper.onrender.com`.
Go back to **Environment** and update `FRONTEND_ORIGIN` to match this URL exactly, then
redeploy (push an empty commit or click "Manual Deploy").

```bash
git commit --allow-empty -m "trigger redeploy after setting FRONTEND_ORIGIN"
git push
```

---

## Day-to-day Operations

### Deploying a code change

```bash
git add .
git commit -m "your message"
git push
```

Render will rebuild and redeploy automatically. Downtime is ~30-60 seconds.

### Viewing logs

- Render Dashboard → campsite-sniper → **Logs**
- Poller logs and web server logs are interleaved here

### Checking the database

You can SSH into your Render service (Starter plan):
```bash
# From Render dashboard: Shell tab, or:
sqlite3 /data/campsite.db ".tables"
sqlite3 /data/campsite.db "SELECT count(*) FROM users;"
sqlite3 /data/campsite.db "SELECT count(*) FROM watches;"
```

### Restarting the service

Render Dashboard → campsite-sniper → **Manual Deploy** → Redeploy last commit.

---

## Scaling Up (when needed)

The current SQLite setup handles dozens of concurrent users comfortably. If you outgrow it:
1. Migrate to PostgreSQL (Render has a managed Postgres add-on)
2. Run the poller as a separate Render Background Worker
3. Both services connect to Postgres instead of SQLite

---

## Environment Variable Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SECRET_KEY` | Yes | — | Signs JWT tokens. Keep secret. |
| `DATA_DIR` | Yes | `data` | Directory for campsite.db. Set to `/data` on Render. |
| `FRONTEND_ORIGIN` | Yes | `http://localhost:5173` | Allowed CORS origin. Set to your Render URL. |
| `RIDB_API_KEY` | Yes | — | Recreation.gov API key for campground search. |
| `EMAIL_FROM` | Yes | — | Gmail address that sends alert emails. |
| `EMAIL_APP_PASSWORD` | Yes | — | Gmail App Password (not login password). |
| `NTFY_TOPIC` | No | — | Default ntfy.sh topic for push notifications. |
| `POLL_INTERVAL_MINUTES` | No | `5` | How often the poller checks availability. |
| `TWILIO_ACCOUNT_SID` | No | — | Twilio SID (SMS not yet implemented). |
| `TWILIO_AUTH_TOKEN` | No | — | Twilio auth token. |
| `TWILIO_FROM_PHONE` | No | — | Twilio sender phone number. |

---

## Troubleshooting

**Build fails on `npm run build`**
- Check that `frontend/package.json` exists and has a `build` script
- Ensure `vite` is listed in `devDependencies`

**Poller not sending notifications**
- Check `EMAIL_FROM` and `EMAIL_APP_PASSWORD` are set correctly
- Gmail must have 2FA enabled to generate an App Password
- Check Render logs for `[notifier]` lines

**Database gets wiped on redeploy**
- You're on the free plan — upgrade to Starter to enable the persistent disk

**CORS errors in browser**
- `FRONTEND_ORIGIN` must exactly match the URL your browser shows (no trailing slash)
- After changing it, redeploy

**Health check failing**
- Render pings `GET /api/health` — ensure the server starts within 2 minutes
- Check build logs for Python import errors
