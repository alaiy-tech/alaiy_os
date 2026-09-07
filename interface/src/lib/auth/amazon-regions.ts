/**
 * Amazon regions, as the SP-API names them.
 *
 * `spapi` is the region code the connector expects; India sits inside Amazon's
 * EU region, which is not obvious and is worth spelling out in the picker.
 */
export const AMAZON_REGIONS = [
  { id: "na", spapi: "NA", label: "North America" },
  { id: "eu", spapi: "EU", label: "Europe" },
  { id: "in", spapi: "EU", label: "India (Amazon EU region)" },
  { id: "fe", spapi: "FE", label: "Far East" },
] as const;

export type AmazonRegionId = (typeof AMAZON_REGIONS)[number]["id"];
