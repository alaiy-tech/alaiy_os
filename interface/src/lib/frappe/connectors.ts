/**
 * The platform's connector-settings API, over `alaiy_os.api.connectors`.
 *
 * Those endpoints are generic over `OS Connector Registry`: they read the field
 * metadata and current values of whatever settings DocType a connector
 * registered, save them back, and run that connector's own `test_method`. So a
 * connector's settings screen needs no Python of its own, and the base needs no
 * knowledge of which connectors exist — the same registry-driven indirection
 * `alaiy_os/connectors.py` already uses to resolve sync methods.
 *
 * A connector's `interface/` imports this to build its own settings screen.
 */

export type ConnectorFieldType =
  | "Data"
  | "Password"
  | "Int"
  | "Float"
  | "Link"
  | "Select"
  | "Check"
  | "Text"
  | "Small Text"
  | "Section Break";

export interface ConnectorField {
  fieldname: string;
  label: string | null;
  fieldtype: ConnectorFieldType;
  /** Link: the target DocType. Select: newline-separated choices. */
  options: string | null;
  reqd: 0 | 1;
  description: string | null;
}

/** A stored secret never comes back — only whether there is one. */
export interface ConnectorPasswordValue {
  _type: "password";
  _set: boolean;
}

export type ConnectorValue = string | number | boolean | null | ConnectorPasswordValue;

export interface ConnectorConfig {
  fields: ConnectorField[];
  values: Record<string, ConnectorValue>;
}

export interface ConnectorTestResult {
  success: boolean;
  message: string;
}

export interface ConnectorRegistryRow {
  connector_id: string;
  connector_name: string;
  connector_app: string;
  connector_type: string;
  description: string | null;
  icon: string | null;
  settings_doctype: string | null;
  is_enabled: 0 | 1;
  connection_status: string | null;
  last_tested_at: string | null;
}

export function isPasswordValue(value: ConnectorValue): value is ConnectorPasswordValue {
  return typeof value === "object" && value !== null && (value as ConnectorPasswordValue)._type === "password";
}

/**
 * These endpoints `frappe.throw` rather than answering `{success: false}` — an
 * unregistered connector or a missing settings DocType is a deployment mistake,
 * not something a user can act on — so the message arrives in `_server_messages`
 * and has to be dug out to be worth showing.
 */
async function callMethod<T>(method: string, body?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`/api/method/${method}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  const text = await res.text();
  let payload: { message?: T; _server_messages?: string; exception?: string } | null = null;
  try {
    payload = JSON.parse(text) as typeof payload;
  } catch {
    payload = null;
  }

  if (!res.ok) throw new Error(serverMessage(payload) ?? `${method} failed (${res.status}).`);
  if (!payload || payload.message === undefined) throw new Error(`${method} returned nothing.`);
  return payload.message;
}

function serverMessage(payload: { _server_messages?: string; exception?: string } | null): string | null {
  if (!payload) return null;
  try {
    const messages = JSON.parse(payload._server_messages ?? "[]") as string[];
    const first = messages.map((entry) => JSON.parse(entry) as { message?: string }).find((entry) => entry.message);
    if (first?.message) return first.message.replace(/<[^>]+>/g, "");
  } catch {
    // fall through to the raw exception line
  }
  return payload.exception ?? null;
}

/** Every registered connector — for a settings index, or one connector's own status. */
export function fetchConnectors(): Promise<ConnectorRegistryRow[]> {
  return callMethod<ConnectorRegistryRow[]>("alaiy_os.api.connectors.get_all_connectors");
}

/** Field metadata plus current values for one connector's settings DocType. */
export function fetchConnectorConfig(connectorId: string): Promise<ConnectorConfig> {
  return callMethod<ConnectorConfig>(
    `alaiy_os.api.connectors.get_connector_config?connector_id=${encodeURIComponent(connectorId)}`,
  );
}

/**
 * Save, then run the connector's own connection test.
 *
 * The two are one call on purpose: settings that were never tested are the
 * reason a connector sits in "untested" forever. A Password field is only
 * written when a non-empty value is sent, so omitting it keeps the stored
 * secret — which is what lets a screen edit everything else without ever
 * holding the password.
 */
export function saveAndTestConnector(
  connectorId: string,
  values: Record<string, unknown>,
): Promise<ConnectorTestResult> {
  return callMethod<ConnectorTestResult>("alaiy_os.api.connectors.save_and_test", {
    connector_id: connectorId,
    values,
  });
}

/** Re-test what is already saved, and update the registry's connection status. */
export function testConnector(connectorId: string): Promise<ConnectorTestResult> {
  return callMethod<ConnectorTestResult>("alaiy_os.api.connectors.test_connector", {
    connector_id: connectorId,
  });
}
