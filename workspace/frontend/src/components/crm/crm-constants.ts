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
