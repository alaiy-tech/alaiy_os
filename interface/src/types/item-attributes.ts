/** One row of an Item Attribute's `item_attribute_values` child table. `name`
 * is the child row's docname — the handle every edit is addressed by, since
 * ERPNext tells a rename from a delete-plus-add by whether that identity
 * survives the save. */
export type ItemAttributeValue = {
  name: string;
  attribute_value: string;
  abbr: string;
};

export type ItemAttributeRow = {
  name: string;
  attribute_name: string;
  disabled: 0 | 1;
  /** Numeric attributes describe their values as a range and carry no
   * `values` at all — ERPNext clears the child table whenever this is set. */
  numeric_values: 0 | 1;
  from_range: number;
  to_range: number;
  increment: number;
  values: ItemAttributeValue[];
  /** Distinct items referencing this attribute, templates included. */
  usage_count: number;
};
