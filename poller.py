import json
import requests
import schedule
import time
from collections import defaultdict
from datetime import datetime, date
from urllib.parse import urlencode
from rich.console import Console
from rich.table import Table

from db import init_db, get_last_status, save_snapshot, save_transition, update_last_status, get_all_watches_with_users
from config import POLL_INTERVAL_MINUTES
from notifier import notify_user

console = Console()

SESSION = requests.Session()
SESSION.headers.update({
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.recreation.gov/",
    "Origin": "https://www.recreation.gov",
    "sec-ch-ua": '"Google Chrome";v="123", "Not:A-Brand";v="8"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"macOS"',
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
    "Connection": "keep-alive",
})


def fetch_availability(campground_id, year, month):
    try:
        SESSION.get("https://www.recreation.gov", timeout=10)
    except Exception as e:
        console.print(f"[yellow]Warning: could not load homepage: {e}[/yellow]")

    base = f"https://www.recreation.gov/api/camps/availability/campground/{campground_id}/month"
    params = urlencode({"start_date": f"{year}-{month:02d}-01T00:00:00.000Z"})
    url = f"{base}?{params}"
    console.print(f"[dim]Fetching: {url}[/dim]")

    try:
        resp = SESSION.get(url, timeout=15)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        console.print(f"[red]Error fetching {campground_id}: {e}[/red]")
        return None


def get_months_needed(dates):
    months = set()
    for d in dates:
        dt = date.fromisoformat(d)
        months.add((dt.year, dt.month))
    return months


def poll_campground(campground_id, campground_name, watch_dates_set, watchers):
    """
    Poll one campground and notify all watchers who care about the found dates.
    watchers: list of dicts with keys user_email, user_name, user_ntfy_topic, dates (set)
    """
    polled_at = datetime.now().isoformat()
    console.print(f"\n[bold cyan]Polling {campground_name} ({campground_id})...[/bold cyan]")

    months = get_months_needed(watch_dates_set)

    for year, month in months:
        data = fetch_availability(campground_id, year, month)
        if not data:
            continue

        campsites = data.get("campsites", {})
        for site_id, site_data in campsites.items():
            for date_str_raw, status in site_data.get("availabilities", {}).items():
                date_str = date_str_raw[:10]
                if date_str not in watch_dates_set:
                    continue

                save_snapshot(campground_id, site_id, date_str, status, polled_at)
                last = get_last_status(campground_id, site_id, date_str)

                if last != status:
                    if last is not None:
                        save_transition(campground_id, site_id, date_str, last, status, polled_at)
                        if status == "Available":
                            site_label = site_data.get("site", site_id)
                            loop = site_data.get("loop", "")
                            console.print(
                                f"[bold green]🏕  CANCELLATION FOUND![/bold green] "
                                f"Site {site_label} on {date_str}"
                            )
                            # Notify each watcher who is watching this date
                            for watcher in watchers:
                                if date_str in watcher["dates"]:
                                    notify_user(
                                        user_email=watcher["user_email"],
                                        user_name=watcher["user_name"],
                                        user_ntfy_topic=watcher.get("user_ntfy_topic", ""),
                                        campground_name=campground_name,
                                        campground_id=campground_id,
                                        site_name=site_label,
                                        date=date_str,
                                        loop=loop,
                                    )
                        else:
                            console.print(
                                f"[yellow]↔ Status change:[/yellow] "
                                f"Site {site_data.get('site', site_id)} "
                                f"{date_str}: {last} → {status}"
                            )
                    update_last_status(campground_id, site_id, date_str, status, polled_at)

    # Summary table
    table = Table(title=f"{campground_name} — {polled_at[:19]}")
    table.add_column("Site", style="cyan")
    table.add_column("Date")
    table.add_column("Status")

    import db as _db
    conn = _db.get_conn()
    rows = conn.execute("""
        SELECT site_id, date, status FROM last_known_status
        WHERE campground_id = ? AND date IN ({})
        ORDER BY date, site_id
    """.format(",".join("?" * len(watch_dates_set))),
        [campground_id] + list(watch_dates_set)
    ).fetchall()
    conn.close()

    for row in rows:
        color = "green" if row["status"] == "Available" else "red"
        table.add_row(row["site_id"], row["date"], f"[{color}]{row['status']}[/{color}]")
    console.print(table)


def poll_all():
    console.print(f"\n[bold]{'='*50}[/bold]")
    console.print(f"[bold]Poll run at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}[/bold]")

    all_watches = get_all_watches_with_users()
    if not all_watches:
        console.print("[dim]No watches configured.[/dim]")
        return

    # Group watches by campground_id so we only hit each campground's API once
    by_campground = defaultdict(lambda: {"name": "", "dates": set(), "watchers": []})
    for watch in all_watches:
        cg_id = watch["campground_id"]
        by_campground[cg_id]["name"] = watch["name"]
        by_campground[cg_id]["dates"].update(watch["dates"])
        by_campground[cg_id]["watchers"].append({
            "user_email":      watch["user_email"],
            "user_name":       watch["user_name"],
            "user_ntfy_topic": watch.get("user_ntfy_topic", ""),
            "dates":           set(watch["dates"]),
        })

    for cg_id, info in by_campground.items():
        poll_campground(cg_id, info["name"], info["dates"], info["watchers"])


def main():
    init_db()
    console.print("[bold green]Campsite Sniper started![/bold green]")
    console.print(f"Polling every {POLL_INTERVAL_MINUTES} min\n")

    poll_all()
    schedule.every(POLL_INTERVAL_MINUTES).minutes.do(poll_all)

    while True:
        schedule.run_pending()
        time.sleep(30)


if __name__ == "__main__":
    main()
