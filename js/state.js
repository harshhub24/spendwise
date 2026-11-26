/* Shared application state + constants (single source of truth). */

export const state = {
  user: null,
  inApp: false,
  view: "overview",
  month: null,            // Date = first day of the month being viewed
  summary: null,
  recent: [],
  expenses: [],
  categoryChart: null,
  trendChart: null,
  searchTimer: null,
  resizeTimer: null,
  eventsBound: false,
};

export const CATEGORY_ICONS = {
  Food: "fa-utensils", Travel: "fa-car", Bills: "fa-bolt",
  Shopping: "fa-bag-shopping", Entertainment: "fa-film", Health: "fa-heart-pulse", Other: "fa-receipt"
};

export const CHART_COLORS = {
  light: { Food: "#d97706", Travel: "#2563eb", Bills: "#9333ea", Shopping: "#db2777", Entertainment: "#ea580c", Health: "#059669", Other: "#94a3b8" },
  dark:  { Food: "#fbbf24", Travel: "#60a5fa", Bills: "#c084fc", Shopping: "#f472b6", Entertainment: "#fb923c", Health: "#34d399", Other: "#64748b" }
};
