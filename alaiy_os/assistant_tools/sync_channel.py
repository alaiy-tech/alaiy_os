"""sync_channel -- trigger a sync for one or all connected channels."""

from typing import Any, Dict

import frappe

from alaiy_os.assistant_tools._base import AlaiyTool
from alaiy_os import connectors


class SyncChannel(AlaiyTool):
    def __init__(self):
        super().__init__()
        self.name = "sync_channel"
        self.description = (
            "Trigger a sync for one connected channel or all of them. Each channel "
            "connector runs the sync as a background job and returns a job/log id you "
            "can poll with get_channel_sync_status. sync_type maps to the operations "
            "the connector actually declares (e.g. Shopify exposes 'orders' and "
            "'inventory'); unsupported operations are reported, not silently skipped."
        )
        self.inputSchema = {
            "type": "object",
            "properties": {
                "channel": {
                    "type": "string",
                    "description": "Channel connector id/name (e.g. 'Shopify'), or 'all' for every enabled channel.",
                    "default": "all",
                },
                "sync_type": {
                    "type": "string",
                    "description": "Which data to sync: 'orders', 'inventory', 'products', or 'all'.",
                    "default": "all",
                },
                "force": {
                    "type": "boolean",
                    "description": "Advisory hint to prefer a full re-sync. Connectors decide incremental vs full internally; not all honour this.",
                    "default": False,
                },
            },
            "required": [],
        }

    def run(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
        channel = (arguments.get("channel") or "all").strip()
        sync_type = (arguments.get("sync_type") or "all").strip().lower()

        if channel.lower() == "all":
            rows = connectors.get_channel_connectors()
        else:
            row = connectors.resolve_channel(channel)
            if not row:
                return self.fail(f"No channel connector matching '{channel}'.")
            rows = [row]

        results = []
        for row in rows:
            entry = {"channel": row["connector_id"], "enabled": bool(row["is_enabled"]), "operations": []}
            if not row["is_enabled"]:
                entry["skipped"] = "connector disabled"
                results.append(entry)
                continue

            ops = connectors.sync_operations(row)  # {label: dotted_method}
            wanted = list(ops.keys()) if sync_type == "all" else [sync_type]

            for op in wanted:
                method = ops.get(op)
                if not method:
                    entry["operations"].append(
                        {"operation": op, "status": "unavailable", "detail": f"'{op}' not supported by this connector"}
                    )
                    continue
                try:
                    res = connectors.call_dotted(method)
                    entry["operations"].append(
                        {
                            "operation": op,
                            "status": "queued",
                            "job_id": (res or {}).get("log_name") if isinstance(res, dict) else None,
                            "result": res,
                        }
                    )
                except Exception as e:
                    frappe.log_error(frappe.get_traceback(), f"sync_channel {row['connector_id']}/{op}")
                    entry["operations"].append({"operation": op, "status": "error", "detail": str(e)})
            results.append(entry)

        return self.ok(sync_type=sync_type, channels=results)
