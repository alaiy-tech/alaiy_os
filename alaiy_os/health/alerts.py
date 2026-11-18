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
_FROM_CONFIG = object()


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
    for change in changes:
        try:
            post(webhook, change_message(change, site, collected))
        except Exception as exc:
            log(f"A connector health alert could not be sent ({type(exc).__name__})")


def _configured_webhook():
    import frappe

    return frappe.conf.get("alert_slack_webhook")


def _site():
    import frappe

    return frappe.local.site


def _log(message):
    import frappe

    frappe.log_error(message, "Connector health alert")


def _post(url, text):
    import requests

    requests.post(url, json={"text": text}, timeout=10).raise_for_status()
