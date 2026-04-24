import smtplib
import requests
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from rich.console import Console

console = Console()


def notify_user(user_email: str, user_name: str, user_ntfy_topic: str,
                campground_name: str, campground_id: str,
                site_name: str, date: str, loop: str = ""):
    """Notify a specific user through their configured channels."""
    msg = _build_message(campground_name, campground_id, site_name, date, loop)
    _send_email_to(user_email, msg)
    if user_ntfy_topic:
        _send_ntfy(user_ntfy_topic, msg)


def notify_all_users(users: list, campground_name: str, campground_id: str,
                     site_name: str, date: str, loop: str = ""):
    """Notify a list of users — called when multiple users watch the same campground."""
    msg = _build_message(campground_name, campground_id, site_name, date, loop)
    for user in users:
        _send_email_to(user["email"], msg)
        if user.get("ntfy_topic"):
            _send_ntfy(user["ntfy_topic"], msg)


def _build_message(campground_name, campground_id, site_name, date, loop=""):
    loop_str = f" ({loop})" if loop else ""
    booking_url = f"https://www.recreation.gov/camping/campgrounds/{campground_id}"
    return {
        "short": f"🏕 {campground_name}: Site {site_name}{loop_str} available on {date}!",
        "long": f"""Availability found at {campground_name}!

Site: {site_name}{loop_str}
Date: {date}

Book now before someone else grabs it:
{booking_url}

— Campsite Sniper""",
        "subject": f"🏕 Site available at {campground_name} on {date}!"
    }


def _send_email_to(to_email: str, message: dict):
    try:
        from config import EMAIL_FROM, EMAIL_APP_PASSWORD
        if not EMAIL_APP_PASSWORD:
            console.print("[yellow]⚠ Email skipped (no app password set)[/yellow]")
            return
        msg = MIMEMultipart()
        msg["From"] = EMAIL_FROM
        msg["To"] = to_email
        msg["Subject"] = message["subject"]
        msg.attach(MIMEText(message["long"], "plain"))
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(EMAIL_FROM, EMAIL_APP_PASSWORD)
            server.sendmail(EMAIL_FROM, to_email, msg.as_string())
        console.print(f"[green]✓ Email sent to {to_email}[/green]")
    except Exception as e:
        console.print(f"[red]Email error ({to_email}): {e}[/red]")


def send_reset_email(to_email: str, name: str, reset_url: str):
    try:
        from config import EMAIL_FROM, EMAIL_APP_PASSWORD
        if not EMAIL_APP_PASSWORD:
            console.print("[yellow]⚠ Reset email skipped (no app password set)[/yellow]")
            return
        msg = MIMEMultipart()
        msg["From"] = EMAIL_FROM
        msg["To"] = to_email
        msg["Subject"] = "Reset your Campsite Sniper password"
        msg.attach(MIMEText(f"""Hi {name},

Click the link below to reset your password. It expires in 1 hour.

{reset_url}

If you didn't request this, you can ignore this email.

— Campsite Sniper""", "plain"))
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(EMAIL_FROM, EMAIL_APP_PASSWORD)
            server.sendmail(EMAIL_FROM, to_email, msg.as_string())
        console.print(f"[green]✓ Reset email sent to {to_email}[/green]")
    except Exception as e:
        console.print(f"[red]Reset email error: {e}[/red]")


def _send_ntfy(topic: str, message: dict):
    try:
        requests.post(
            f"https://ntfy.sh/{topic}",
            data=message["short"].encode("utf-8"),
            headers={"Title": message["subject"], "Priority": "urgent", "Tags": "tent,rotating_light"},
            timeout=10,
        )
        console.print(f"[green]✓ ntfy sent to {topic}[/green]")
    except Exception as e:
        console.print(f"[red]ntfy error ({topic}): {e}[/red]")
