import type { BadgeProps } from "@/components/ui/badge";

/**
 * Status -> pill tone, mirrors statusPill() in the approved design
 * (mydesign/Alaiy OS Dashboard.dc.html). Extend this map, don't invent new
 * tones inline - every status badge in the app should be one of Badge's
 * five status variants (success/warning/info/danger/neutral).
 */
const STATUS_TONE: Record<string, NonNullable<BadgeProps["variant"]>> = {
  Completed: "success",
  Paid: "success",
  Active: "success",
  "Low stock": "warning",
  "To Bill": "warning",
  "To Deliver": "warning",
  "On Hold": "warning",
  "To Deliver and Bill": "info",
  Overdue: "danger",
  Cancelled: "danger",
  "Out of stock": "danger",
  Draft: "neutral",
  Closed: "neutral",
  Disabled: "neutral",
  Pending: "neutral",
};

export function statusTone(status: string): NonNullable<BadgeProps["variant"]> {
  return STATUS_TONE[status] ?? "neutral";
}
