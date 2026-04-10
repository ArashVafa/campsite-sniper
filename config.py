import os
from dotenv import load_dotenv

load_dotenv()

POLL_INTERVAL_MINUTES = int(os.environ.get("POLL_INTERVAL_MINUTES", "5"))

RIDB_API_KEY = os.environ.get("RIDB_API_KEY", "")

# Notification settings
NTFY_TOPIC = os.environ.get("NTFY_TOPIC", "")
EMAIL_FROM = os.environ.get("EMAIL_FROM", "")
EMAIL_APP_PASSWORD = os.environ.get("EMAIL_APP_PASSWORD", "")
TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN", "")
TWILIO_FROM_PHONE = os.environ.get("TWILIO_FROM_PHONE", "")
TWILIO_TO_PHONE = os.environ.get("TWILIO_TO_PHONE", "")

# Must be a long random string — used to sign auth tokens
SECRET_KEY = os.environ.get("SECRET_KEY", "change-me-to-a-long-random-secret")

# Frontend origin (used for CORS)
FRONTEND_ORIGIN = os.environ.get("FRONTEND_ORIGIN", "http://localhost:5173")
