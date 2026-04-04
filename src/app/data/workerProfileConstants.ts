/** What kind of work / labour the person offers (employer filter + form) */
export const WORKER_TRADE_CATEGORIES = [
  "General labour",
  "Construction & masonry",
  "Electrical work",
  "Plumbing",
  "Welding & metalwork",
  "Painting",
  "Domestic help & housekeeping",
  "Gardening & agriculture",
  "Driving & logistics",
  "Security",
  "Retail & sales",
  "Office & admin",
  "Hospitality & catering",
  "Care work",
  "Technician / repairs",
  "Other",
] as const;

export type WorkerTradeCategory = (typeof WORKER_TRADE_CATEGORIES)[number];

export const WORKER_AVAILABILITY_OPTIONS = [
  "Available immediately",
  "Within 1 week",
  "Within 2–4 weeks",
  "Part-time only",
  "Flexible / discuss",
] as const;
