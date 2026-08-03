export const LEAD_STATUSES = [
  { key: "NEW", label: "New", color: "bg-sky-500" },
  { key: "CONTACTED", label: "Contacted", color: "bg-amber-500" },
  { key: "QUALIFIED", label: "Qualified", color: "bg-violet-500" },
  { key: "PROPOSAL", label: "Proposal", color: "bg-orange-500" },
  { key: "WON", label: "Won", color: "bg-emerald-500" },
  { key: "LOST", label: "Lost", color: "bg-rose-500" },
] as const;

export const DEAL_STATUSES = [
  { key: "OPEN", label: "Open", color: "bg-sky-500" },
  { key: "QUALIFICATION", label: "Qualification", color: "bg-violet-500" },
  { key: "PROPOSAL", label: "Proposal", color: "bg-orange-500" },
  { key: "NEGOTIATION", label: "Negotiation", color: "bg-amber-500" },
  { key: "WON", label: "Won", color: "bg-emerald-500" },
  { key: "LOST", label: "Lost", color: "bg-rose-500" },
] as const;

/** Stage likelihood used for weighted pipeline (UI-only). */
export const DEAL_STAGE_PROBABILITY: Record<string, number> = {
  OPEN: 10,
  QUALIFICATION: 25,
  PROPOSAL: 50,
  NEGOTIATION: 75,
  WON: 100,
  LOST: 0,
};

export const DEAL_LOST_REASONS = [
  "Price",
  "Competitor",
  "No budget",
  "Timing",
  "No response",
  "Other",
] as const;

export const LEAD_SOURCES = [
  "WEBSITE",
  "REFERRAL",
  "COLD_CALL",
  "EMAIL",
  "SOCIAL",
  "EVENT",
  "PARTNER",
  "OTHER",
] as const;

export type LeadStatusKey = (typeof LEAD_STATUSES)[number]["key"];
export type DealStatusKey = (typeof DEAL_STATUSES)[number]["key"];
