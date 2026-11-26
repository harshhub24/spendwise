/* Small helpers: DOM, money/date formatting, toasts, server status. */

export const $ = (selector) => document.querySelector(selector);

const inr0 = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const inr2 = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const money = (value) => inr0.format(Math.round(Number(value) || 0));
export const money2 = (value) => inr2.format(Number(value) || 0);

export const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

export const dateOnly = (d) => {
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10);
};

export const capitalize = (value) => (value ? value.charAt(0).toUpperCase() + value.slice(1) : value);

export function monthLabel(key, { short = false } = {}) {
  if (!key) return "—";
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-IN", { month: short ? "short" : "long", year: "numeric" });
}

export function prevMonthKey(key) {
  const [year, month] = key.split("-").map(Number);
  return monthKey(new Date(year, month - 2, 1));
}

export const escapeHTML = (value) =>
  String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

export const categoryClass = (category) =>
  String(category || "Other").toLowerCase().replace(/[^a-z]/g, "");

export const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function setServerStatus(status, label) {
  const badge = $("#server-status");
  if (!badge) return;
  badge.classList.remove("online", "offline");
  if (status) badge.classList.add(status);
  $("#server-label").textContent = label;
}

export function toast(message, error = false) {
  const item = document.createElement("div");
  item.className = `toast${error ? " error" : ""}`;
  item.innerHTML = `<i class="fa-solid ${error ? "fa-circle-exclamation" : "fa-circle-check"}"></i><span></span>`;
  item.querySelector("span").textContent = message;
  $("#toast-region").append(item);
  window.setTimeout(() => item.remove(), 3800);
}
