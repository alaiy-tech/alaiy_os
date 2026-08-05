// Status-to-tone maps for `os-dynamic-badge` (`utils/get-badge-style.ts`),
// one per ERPNext document category. Every value reuses `STATUS_TONE`
// (`constants/list.ts`) rather than a hardcoded colour, so a badge repaints
// correctly across every theme preset the same way any other status pill
// already does.
import { STATUS_TONE } from "./list";

export const docStatusColorMap: Record<string, string> = {
  draft: STATUS_TONE.neutral,
  submitted: STATUS_TONE.info,
  cancelled: STATUS_TONE.destructive,
};

export const jobStatusColorMap: Record<string, string> = {
  queued: STATUS_TONE.neutral,
  running: STATUS_TONE.info,
  success: STATUS_TONE.success,
  failed: STATUS_TONE.destructive,
  skipped: STATUS_TONE.neutral,
  cancelled: STATUS_TONE.neutral,
  scheduled: STATUS_TONE.info,
};

export const paymentStatusColorMap: Record<string, string> = {
  paid: STATUS_TONE.success,
  unpaid: STATUS_TONE.warning,
  "partially paid": STATUS_TONE.info,
  overdue: STATUS_TONE.destructive,
  initiated: STATUS_TONE.info,
  requested: STATUS_TONE.info,
  refunded: STATUS_TONE.destructive,
  "credit note issued": STATUS_TONE.info,
};

export const salesStatusColorMap: Record<string, string> = {
  lead: STATUS_TONE.neutral,
  open: STATUS_TONE.info,
  replied: STATUS_TONE.info,
  opportunity: STATUS_TONE.info,
  "quotation created": STATUS_TONE.info,
  "to deliver and bill": STATUS_TONE.warning,
  "to bill": STATUS_TONE.warning,
  "to deliver": STATUS_TONE.warning,
  completed: STATUS_TONE.success,
  converted: STATUS_TONE.success,
  lost: STATUS_TONE.destructive,
  closed: STATUS_TONE.neutral,
  "on hold": STATUS_TONE.warning,
};

export const stockStatusColorMap: Record<string, string> = {
  pending: STATUS_TONE.warning,
  "to receive and bill": STATUS_TONE.warning,
  "to receive": STATUS_TONE.warning,
  "partially ordered": STATUS_TONE.info,
  ordered: STATUS_TONE.info,
  stopped: STATUS_TONE.destructive,
  active: STATUS_TONE.success,
  expired: STATUS_TONE.destructive,
};

export const projectTaskStatusColorMap: Record<string, string> = {
  open: STATUS_TONE.info,
  working: STATUS_TONE.info,
  "pending review": STATUS_TONE.warning,
  overdue: STATUS_TONE.destructive,
  completed: STATUS_TONE.success,
  cancelled: STATUS_TONE.neutral,
};

export const hrStatusColorMap: Record<string, string> = {
  present: STATUS_TONE.success,
  absent: STATUS_TONE.destructive,
  "on leave": STATUS_TONE.warning,
  "half day": STATUS_TONE.info,
  "work from home": STATUS_TONE.info,
  approved: STATUS_TONE.success,
  rejected: STATUS_TONE.destructive,
};

export const manufacturingStatusColorMap: Record<string, string> = {
  "not started": STATUS_TONE.neutral,
  "in process": STATUS_TONE.info,
  "work in progress": STATUS_TONE.info,
  completed: STATUS_TONE.success,
  stopped: STATUS_TONE.destructive,
};

export const defaultBadgeStyle = STATUS_TONE.neutral;
