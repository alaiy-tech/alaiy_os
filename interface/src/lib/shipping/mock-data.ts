import { isoDate } from "@/lib/dates";
import type {
  CarrierRow,
  ChartAnnotation,
  HandlingTimePoint,
  LateShipment,
  ShippingSummary,
} from "./types";

/**
 * Seed data for the Shipping tab — see the issue's own examples, which this
 * follows closely: a 3PL switch that spikes handling time and is still
 * recovering, a regional Delhivery slowdown, and four undispatched Amazon
 * orders that would push the Late Shipment Rate over Amazon's 4% threshold.
 *
 * Dates are relative to `today`, same reasoning as Support's and Ratings'
 * mock data — a spike "10 days ago" stays true whenever this is opened.
 */
export function buildMockShippingData(today = new Date()) {
  const ago = (days: number) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - days);
    return isoDate(d);
  };

  const summary: ShippingSummary = {
    // Recovering from the 3PL-switch spike below, but not back to the old
    // 3PL's ~14h baseline yet — the 7-day arrow reads as improving even
    // though the number is still well above where it started.
    avgHandlingHours: { value: 22, previous: 29 },
    onTimeDispatchPct: { value: 91, previous: 95 },
    onTimeDeliveryPct: { value: 88, previous: 92 },
    lateShipmentRatePct: { value: 3.8, previous: 3.2 },
  };

  // Flat ~14h baseline on the old 3PL, a switch, a spike to 31h, then a
  // steady recovery to 22h today — the issue's own handling-time example.
  const baseline = [14, 13, 15, 14, 13, 15, 14, 13, 14, 15, 14, 13, 15, 14, 13, 14, 15, 14, 14];
  const afterSwitch = [24, 31, 29, 29, 27, 26, 25, 24, 23, 22, 22];
  const hours = [...baseline, ...afterSwitch];
  const handlingTimeTrend: HandlingTimePoint[] = hours.map((avgHours, index) => ({
    date: ago(hours.length - 1 - index),
    avgHours,
  }));

  const switchDayIndex = baseline.length; // first point of afterSwitch
  const annotations: ChartAnnotation[] = [
    { date: ago(hours.length - 1 - switchDayIndex), label: "Switched Shopify fulfilment to new 3PL" },
  ];

  const carriers: CarrierRow[] = [
    {
      id: "delhivery",
      name: "Delhivery",
      isFBA: false,
      shipments: 142,
      onTimePct: 81,
      avgTransitDays: 3.2,
      exceptions: { stuck: 4, lost: 1, returned: 3 },
    },
    {
      id: "shiprocket",
      name: "Shiprocket",
      isFBA: false,
      shipments: 98,
      onTimePct: 93,
      avgTransitDays: 2.8,
      exceptions: { stuck: 1, lost: 0, returned: 2 },
    },
    {
      id: "amazon-fba",
      name: "Amazon FBA",
      isFBA: true,
      shipments: 210,
      onTimePct: 97,
      avgTransitDays: 2.1,
      exceptions: { stuck: 0, lost: 1, returned: 4 },
    },
    {
      id: "ecom-express",
      name: "Ecom Express",
      isFBA: false,
      shipments: 36,
      onTimePct: 89,
      avgTransitDays: 3.5,
      exceptions: { stuck: 2, lost: 0, returned: 1 },
    },
  ];

  // Four Amazon orders not yet dispatched, inside the Late Shipment Rate
  // window, plus two Shopify orders that already shipped late — the same
  // "6 orders, 4 in the LSR window" split the issue's example describes.
  const lateShipments: LateShipment[] = [
    {
      id: "ls-1",
      channel: "amazon",
      orderNumber: "112-3344551",
      externalOrderId: "112-3344551",
      carrier: "Delhivery",
      expectedShipDate: ago(0),
      status: "at_risk",
      daysLate: 0,
    },
    {
      id: "ls-2",
      channel: "amazon",
      orderNumber: "112-3344872",
      externalOrderId: "112-3344872",
      carrier: "Shiprocket",
      expectedShipDate: ago(0),
      status: "at_risk",
      daysLate: 0,
    },
    {
      id: "ls-3",
      channel: "amazon",
      orderNumber: "112-3345190",
      externalOrderId: "112-3345190",
      carrier: "Delhivery",
      expectedShipDate: ago(1),
      status: "at_risk",
      daysLate: 0,
    },
    {
      id: "ls-4",
      channel: "amazon",
      orderNumber: "112-3345407",
      externalOrderId: "112-3345407",
      carrier: "Delhivery",
      expectedShipDate: ago(1),
      status: "at_risk",
      daysLate: 0,
    },
    {
      id: "ls-5",
      channel: "shopify",
      orderNumber: "#1042",
      externalOrderId: "1042",
      carrier: "Shiprocket",
      expectedShipDate: ago(2),
      status: "shipped_late",
      daysLate: 1,
    },
    {
      id: "ls-6",
      channel: "shopify",
      orderNumber: "#1050",
      externalOrderId: "1050",
      carrier: "Ecom Express",
      expectedShipDate: ago(3),
      status: "shipped_late",
      daysLate: 2,
    },
  ];

  return { summary, handlingTimeTrend, annotations, carriers, lateShipments };
}
