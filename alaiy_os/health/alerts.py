"""Slack messages for connector health: one per change, a recovery message, and a daily digest.

Text is built from state the engine already scrubbed and is scrubbed again here, so a secret cannot
reach Slack by any path. A failure to post is logged without the webhook and never raised.
"""

from alaiy_os.health.scrub import scrub

STATE_LABELS = {
    "overdue": "Overdue", "stuck": "Stuck", "failing": "Failing", "config_invalid": "Config invalid",
    "warning": "Warning", "healthy": "Healthy", "no_data": "No data", "disabled": "Disabled",
    "red": "Red", "warn": "Warning", "ok": "OK", "unknown": "Unknown",
}
DEFAULT_COOLDOWN_MIN = 60
BATCH_OVER = 5  # more changes than this in one run (a first run, an outage) go out as one summary
_FROM_CONFIG = object()


def _on(value, default=True):
    return default if value is None else value not in (0, False, "0", "")


def resolve_alert_config(settings, site_conf):
    """How alerts behave. The Connector Health Settings page wins; a `alert_slack_webhook` in the site
    config is the fallback. `settings` is the page's values (or None before it exists)."""
    page = settings or {}
    page_hook = page.get("slack_webhook")
    page_hook = page_hook.strip() if isinstance(page_hook, str) else ""
    conf_hook = site_conf.get("alert_slack_webhook")
    webhook = page_hook or (conf_hook.strip() if isinstance(conf_hook, str) and conf_hook.strip() else None)
    try:
        cooldown = int(page.get("alert_cooldown_minutes"))
    except (TypeError, ValueError):
        cooldown = 0
    return {
        "webhook": webhook,
        "enabled": bool(webhook) and _on(page.get("alerts_enabled")),
        "digest": _on(page.get("daily_digest")),
        "cooldown_min": cooldown if cooldown > 0 else DEFAULT_COOLDOWN_MIN,
    }


def valid_webhook(url):
    """An https URL, or nothing. Anything else is refused when the settings are saved."""
    if not url:
        return True
    from urllib.parse import urlparse

    parsed = urlparse(str(url))
    return parsed.scheme == "https" and bool(parsed.netloc) and not any(ch.isspace() for ch in str(url))


def _settings_values():
    import frappe

    try:
        doc = frappe.get_single("Connector Health Settings")
        return {
            "alerts_enabled": doc.alerts_enabled,
            "slack_webhook": doc.get_password("slack_webhook", raise_exception=False),
            "daily_digest": doc.daily_digest,
            "alert_cooldown_minutes": doc.alert_cooldown_minutes,
        }
    except Exception:
        return None  # before the settings doctype is migrated in: the site config alone


def alert_config():
    import frappe

    return resolve_alert_config(_settings_values(), frappe.conf)


def _label(state):
    return STATE_LABELS.get(state, str(state).replace("_", " ").title())


def _lookup(key, collected):
    """(title, reason, last_error) for a state key, tolerating one that no longer exists."""
    group, _, name = key.partition("::")
    if group == "platform":
        for check in collected.get("platform", []):
            if check["key"] == name:
                return check["label"], check.get("detail", ""), ""
    for connector in collected.get("connectors", []):
        if connector["connector_id"] == group:
            for function in connector["functions"]:
                if function["key"] == name:
                    return (f"{connector['connector_name']} - {function['label']}",
                            function.get("reason", ""), function.get("last_error", ""))
    return key.replace("::", " - "), "", ""


def change_message(change, site, collected):
    title, reason, error = _lookup(change["key"], collected)
    when = change["at"].strftime("%Y-%m-%d %H:%M")
    if change["kind"] == "recovery":
        head = f"Connector health: {title} recovered (now {_label(change['new'])})"
    else:
        head = f"Connector health: {title} is {_label(change['new'])}"
    lines = [head, f"Instance: {site}", f"Since: {when}"]
    if reason:
        lines.append(scrub(reason))
    if error and change["kind"] != "recovery":
        lines.append(f"Last error: {scrub(error)}")
    return "\n".join(lines)


def batch_message(changes, site, collected):
    lines = [f"Connector health: {len(changes)} changes on {site}"]
    for change in changes[:20]:
        title, reason, _ = _lookup(change["key"], collected)
        verb = "recovered" if change["kind"] == "recovery" else _label(change["new"])
        lines.append(f"- {title}: {verb}" + (f" ({scrub(reason)})" if reason and change["kind"] != "recovery" else ""))
    if len(changes) > 20:
        lines.append(f"... and {len(changes) - 20} more")
    return "\n".join(lines)


def digest_message(site, collected):
    """Everything not healthy, or None when there is nothing to report."""
    items = []
    for check in collected.get("platform", []):
        if check["state"] in ("red", "warn"):
            items.append(f"- {check['label']}: {_label(check['state'])} ({scrub(check.get('detail', ''))})")
    for connector in collected.get("connectors", []):
        for function in connector["functions"]:
            if function["state"] not in ("healthy", "disabled"):
                items.append(f"- {connector['connector_name']} - {function['label']}: "
                             f"{_label(function['state'])} ({scrub(function.get('reason', ''))})")
    if not items:
        return None
    return "\n".join([f"Connector health digest for {site}: {len(items)} not healthy", *items])


def notify(changes, collected, *, site=None, webhook=_FROM_CONFIG, post=None, log=None):
    """Post one message per change. No webhook means no messages."""
    if webhook is _FROM_CONFIG:
        webhook = _configured_webhook()
    if not webhook:
        return
    site = site or _site()
    post = post or _post
    log = log or _log
    messages = ([batch_message(changes, site, collected)] if len(changes) > BATCH_OVER
                else [change_message(change, site, collected) for change in changes])
    for text in messages:
        try:
            post(webhook, text)
        except Exception as exc:
            log(f"A connector health alert could not be sent ({type(exc).__name__})")


def _configured_webhook():
    config = alert_config()
    return config["webhook"] if config["enabled"] else None


def _site():
    import frappe

    return frappe.local.site


def _log(message):
    import frappe

    frappe.log_error(message, "Connector health alert")


def _post(url, text):
    import requests

    requests.post(url, json={"text": text}, timeout=10).raise_for_status()
