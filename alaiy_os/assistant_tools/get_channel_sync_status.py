"""get_channel_sync_status -- health and last-sync status of every channel."""

from typing import Any, Dict

import frappe

from alaiy_os.assistant_tools._base import AlaiyTool
from alaiy_os import connectors


class GetChannelSyncStatus(AlaiyTool):
    def __init__(self):
        super().__init__()
        self.name = "get_channel_sync_status"
        self.description = (
            "Get the health and last-sync status of all connected channels: whether "
            "each connector is enabled, its connection status, when it was last tested, "
            "and its most recent sync activity (from the connector's own status method)."
        )
        self.inputSchema = {"type": "object", "properties": {}, "required": []}

    def run(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
        channels = []
        for row in connectors.get_channel_connectors():
            entry = {
                "channel": row["connector_id"],
                "name": row.get("connector_name"),
                "enabled": bool(row["is_enabled"]),
                "connection_status": row.get("connection_status"),
                "last_tested_at": str(row.get("last_tested_at")) if row.get("last_tested_at") else None,
            }
            method = row.get("sync_status_method")
            if method and row["is_enabled"]:
                try:
                    entry["recent_syncs"] = connectors.call_dotted(method)
                except Exception as e:
                    frappe.log_error(frappe.get_traceback(), f"get_channel_sync_status {row['connector_id']}")
                    entry["status_error"] = str(e)
            channels.append(entry)

        return self.ok(channels=channels)
