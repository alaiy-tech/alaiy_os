/** The platform's connector-settings API vocabulary
 * (`lib/frappe/connectors.ts`, over `alaiy_os.api.connectors`). A
 * connector's `interface/` imports these to build its own settings screen -
 * see that file's own module doc comment for the registry-driven design. */

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
