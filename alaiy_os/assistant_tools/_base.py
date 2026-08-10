"""Shared base for Alaiy OS MCP tools.

Extends Frappe Assistant Core's `BaseTool` with:
- a consistent category / source_app,
- declarative role gating driven by `alaiy_os.assistant_tools.permissions`,
- a small result-envelope + arg-coercion helper set,
so each concrete tool only has to implement `run(arguments) -> dict`.

FAC discovers each tool through the `assistant_tools` hook, instantiates it,
optionally calls `validate_arguments()`, then calls `execute()`. We override
`execute()` to enforce roles before dispatching to `run()`. Every tool call
(and its result) is audit-logged by FAC's `Assistant Audit Log`.

NOTE ON THE FAC IMPORT BELOW: it is a hard, top-level import, but it does NOT
make frappe_assistant_core a dependency of alaiy_os. Nothing in alaiy_os
imports this module — hooks.py lists tool classes as dotted-path *strings*, and
FAC's custom_tools plugin is the only thing that ever resolves them. On a site
without FAC installed, this file is never imported and alaiy_os runs normally.
Do not import it from anywhere else, or that stops being true.

Apps outside alaiy_os (agent apps, connector apps) subclass AlaiyTool too, and
register their own tools via their own `assistant_tools` hook and their roles
via `assistant_tool_roles`. They need no changes here.
"""

import json
from typing import Any, Dict, List

import frappe
from frappe import _

from frappe_assistant_core.core.base_tool import BaseTool

from alaiy_os.assistant_tools.permissions import SUPERUSER_ROLES, roles_for


class AlaiyTool(BaseTool):
    """Base class for Alaiy OS commerce tools."""

    def __init__(self):
        super().__init__()
        self.category = "Alaiy OS"
        # Root package of the concrete subclass, so a tool shipped by an agent
        # or connector app is attributed to that app in FAC's tool registry
        # rather than to alaiy_os.
        self.source_app = (type(self).__module__ or "alaiy_os").split(".")[0]

    # ── Lifecycle ────────────────────────────────────────────────────────────
    def execute(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
        arguments = arguments or {}
        self.check_alaiy_roles()
        return self.run(arguments)

    def run(self, arguments: Dict[str, Any]) -> Dict[str, Any]:  # pragma: no cover
        raise NotImplementedError(f"{self.__class__.__name__} must implement run()")

    # ── Permission helpers ───────────────────────────────────────────────────
    def _user_roles(self) -> set:
        return set(frappe.get_roles(frappe.session.user))

    def check_alaiy_roles(self) -> None:
        """Gate on the tool's declarative allow-list (permissions.roles_for)."""
        allowed = roles_for(self.name)
        if self._user_roles().isdisjoint(allowed):
            frappe.throw(
                _("You do not have permission to run '{0}'. Requires one of: {1}.").format(
                    self.name, ", ".join(allowed)
                ),
                frappe.PermissionError,
            )

    def require_admin(self, action: str) -> None:
        """Extra gate for the destructive branch of an otherwise-Ops tool."""
        if self._user_roles().isdisjoint(set(SUPERUSER_ROLES)):
            frappe.throw(
                _("{0} requires the Alaiy Admin role (or System/OS Manager).").format(action),
                frappe.PermissionError,
            )

    # ── Result + argument helpers ────────────────────────────────────────────
    @staticmethod
    def ok(**data) -> Dict[str, Any]:
        return {"success": True, **data}

    @staticmethod
    def fail(message: str, **data) -> Dict[str, Any]:
        return {"success": False, "error": message, **data}

    @staticmethod
    def as_list(value) -> List[Any]:
        """Coerce an argument that may arrive as a JSON string, list, or scalar."""
        if value is None or value == "":
            return []
        if isinstance(value, list):
            return value
        if isinstance(value, str):
            stripped = value.strip()
            if stripped.startswith("["):
                try:
                    parsed = json.loads(stripped)
                    return parsed if isinstance(parsed, list) else [parsed]
                except json.JSONDecodeError:
                    pass
            return [stripped]
        return [value]

    @staticmethod
    def require(arguments: Dict[str, Any], *names) -> None:
        missing = [n for n in names if not arguments.get(n)]
        if missing:
            frappe.throw(
                _("Missing required argument(s): {0}").format(", ".join(missing)),
                frappe.ValidationError,
            )
