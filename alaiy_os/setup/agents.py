"""
Provisioning for seeded agents — reconciles OS Agent / OS Agent Tool records
to match constants/agents.py on every install and migrate, the same way
install.py reconciles workspaces and branding.

Upserts only records named in the constants; agents or tools the admin
created by hand are never touched.
"""

import json

import frappe

from alaiy_os.constants.agents import AGENT_TOOLS, AGENTS


def provision_agents():
    for tool in AGENT_TOOLS:
        _upsert("OS Agent Tool", tool["tool_id"], {
            "tool_id": tool["tool_id"],
            "description": tool["description"],
            "handler": tool["handler"],
            "parameters_schema": json.dumps(tool["parameters_schema"], indent=1),
        })

    for agent in AGENTS:
        doc = _upsert("OS Agent", agent["agent_id"], {
            "agent_id": agent["agent_id"],
            "description": agent["description"],
            "model": agent["model"],
            "max_turns": agent["max_turns"],
            "system_prompt": agent["system_prompt"],
            "output_format": agent["output_format"],
            "output_schema": agent["output_schema"],
        })
        doc.set("tools", [{"tool": tool_id} for tool_id in agent["tools"]])
        doc.save(ignore_permissions=True)


def _upsert(doctype, name, values):
    if frappe.db.exists(doctype, name):
        doc = frappe.get_doc(doctype, name)
        doc.update(values)
        doc.save(ignore_permissions=True)
    else:
        doc = frappe.get_doc({"doctype": doctype, **values})
        doc.insert(ignore_permissions=True)
    return doc
