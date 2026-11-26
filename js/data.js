/* Data layer: loading, rendering, month navigation, KPI count-up animation. */

import { state, CATEGORY_ICONS } from "./state.js";
import {
  $, money, money2, monthKey, dateOnly, capitalize, monthLabel, prevMonthKey,
  escapeHTML, categoryClass, prefersReducedMotion, setServerStatus, toast
} from "./utils.js";
import { request } from "./api.js";
import { updateCharts } from "./charts.js";

/* ---------- KPI count-up ---------- */

export function animateMoney(el, target, formatter = money) {
  const to = Number(target) || 0;
  const from = Number(el.dataset.value || 0);
  el.dataset.value = to;
  if (prefersReducedMotion() || from === to) {
    el.textContent = formatter(to);
    return;
  }
  const duration = 650;
  const start = performance.now();
  if (el._raf) cancelAnimationFrame(el._raf);
  const step = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = formatter(from + (to - from) * eased);
    if (progress < 1) el._raf = requestAnimationFrame(step);
  };
  el._raf = requestAnimationFrame(step);
}

/* ---------- greeting & month navigation ---------- */

export function setGreeting() {
  const hour = new Date().getHours();
  const part = hour < 5 ? "Working late" : hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  $("#greeting").textContent = `${part}, ${capitalize(state.user) || "there"}`;
  $("#today-label").textContent = new Date()
    .toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    .toUpperCase();
}

export function isCurrentMonth() {
  return monthKey(state.month) === monthKey(new Date());
}

export function updateMonthLabel() {
  const label = $("#month-label");
  label.textContent = state.month.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  $("#month-next").disabled = isCurrentMonth();
  label.classList.remove("bump");
  void label.offsetWidth;
  label.classList.add("bump");
}

export function shiftMonth(delta) {
  const next = new Date(state.month);
  next.setDate(1);
  next.setMonth(next.getMonth() + delta);
  if (monthKey(next) > monthKey(new Date())) return;
  state.month = next;
  updateMonthLabel();
  loadData();
}

/* ---------- loading ---------- */

export async function loadData() {
  try {
    const summary = await request(`/summary?month=${monthKey(state.month)}`);
    state.summary = summary;
    renderSummary();
    setServerStatus("online", "Online");
    const recent = await request("/expenses?limit=5");
    renderRecent(recent);
    if (state.view === "transactions") await loadExpenses();
  } catch (error) {
    if (error.status !== 401) {
      setServerStatus("offline", "Offline");
      toast(error.message || "Could not load your dashboard.", true);
    }
  }
}

export async function loadExpenses() {
  const params = new URLSearchParams();
  const search = $("#search-input").value.trim();
  const category = $("#category-filter").value;
  const payment = $("#payment-filter").value;
  if (search) params.set("search", search);
  if (category) params.set("category", category);
  if (payment) params.set("payment_mode", payment);
  const preset = $("#date-filter").value;
  const today = new Date();
  if (preset === "today") {
    params.set("start_date", dateOnly(today));
    params.set("end_date", dateOnly(today));
  } else if (preset === "week") {
    const start = new Date(today);
    start.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    params.set("start_date", dateOnly(start));
    params.set("end_date", dateOnly(today));
  } else if (preset === "month") {
    params.set("start_date", dateOnly(new Date(today.getFullYear(), today.getMonth(), 1)));
    params.set("end_date", dateOnly(today));
  }
  const expenses = await request(`/expenses${params.toString() ? `?${params}` : ""}`);
  renderExpenses(expenses);
}

export async function refreshAll() {
  await loadData();
  if (state.view === "transactions") await loadExpenses();
}

/* ---------- rendering ---------- */

export function renderSummary() {
  const s = state.summary;
  animateMoney($("#budget-spent"), s.total_spent);
  $("#budget-total").textContent = money(s.monthly_budget);
  const percent = s.monthly_budget ? (s.total_spent / s.monthly_budget) * 100 : 0;
  $("#budget-percent").textContent = `${Math.round(percent)}% used`;
  $("#budget-percent").classList.toggle("warn", percent >= 70 && percent <= 100);
  $("#budget-percent").classList.toggle("over", percent > 100);
  const bar = $("#budget-progress");
  bar.style.width = `${Math.min(percent, 100)}%`;
  bar.classList.toggle("warn", percent >= 70 && percent <= 100);
  bar.classList.toggle("over", percent > 100);
  $("#budget-caption").textContent = percent > 100
    ? `You're ${money(s.total_spent - s.monthly_budget)} over budget for ${monthLabel(monthKey(state.month))}.`
    : `${money(Math.max(s.remaining_budget, 0))} left in ${monthLabel(monthKey(state.month))}.`;

  animateMoney($("#kpi-spend"), s.total_spent);
  const delta = $("#kpi-spend-delta");
  if (s.month_change_pct !== null) {
    const up = s.month_change_pct > 0;
    delta.innerHTML = `<i class="fa-solid ${up ? "fa-arrow-trend-up" : "fa-arrow-trend-down"}"></i> <span class="${up ? "up" : "down"}">${Math.abs(s.month_change_pct)}% vs ${monthLabel(prevMonthKey(monthKey(state.month)), { short: true })}</span>`;
  } else if (s.prev_month_total === 0 && s.total_spent > 0) {
    delta.innerHTML = `<span class="up">New</span> — nothing spent last month`;
  } else {
    delta.textContent = "No comparison available yet";
  }

  animateMoney($("#kpi-remaining"), s.remaining_budget);
  const remainingFoot = $("#kpi-remaining-foot");
  if (s.remaining_budget < 0) {
    remainingFoot.innerHTML = `<span class="up">Over budget this month</span>`;
  } else {
    remainingFoot.textContent = `Against your ${money(s.monthly_budget)} budget`;
  }

  animateMoney($("#kpi-average"), s.daily_average);
  $("#kpi-category").textContent = s.highest_category?.name || "—";
  $("#kpi-category-foot").textContent = s.highest_category
    ? `${s.highest_category.percentage}% of the month's spend`
    : "No spending yet";

  const monthShort = state.month.toLocaleDateString("en-IN", { month: "short" });
  $("#donut-subtitle").textContent = `${monthShort} ${state.month.getFullYear()}`;
  const trendLength = (s.daily_totals || []).length;
  $("#trend-subtitle").textContent = trendLength ? `1–${trendLength} ${monthShort}` : monthShort;
  updateCharts();
}

function renderRecent(expenses) {
  state.recent = expenses;
  const list = $("#recent-list");
  list.replaceChildren();
  $("#recent-empty").classList.toggle("hidden", expenses.length > 0);
  for (const expense of expenses) {
    const item = document.createElement("li");
    item.className = "recent-item";
    item.dataset.id = expense.id;
    const dateStr = new Date(`${expense.date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    item.innerHTML = `
      <span class="category-icon tint-${escapeHTML(expense.category)}"><i class="fa-solid ${CATEGORY_ICONS[expense.category] || CATEGORY_ICONS.Other}"></i></span>
      <div class="recent-info"><span class="recent-title"></span><span class="recent-date">${dateStr} · ${escapeHTML(expense.payment_mode)}</span></div>
      <span class="recent-amount">${money(expense.amount)}</span>
      <i class="fa-solid fa-chevron-right recent-arrow"></i>`;
    item.querySelector(".recent-title").textContent = expense.title;
    list.append(item);
  }
}

export function renderExpenses(expenses) {
  state.expenses = expenses;
  const body = $("#expense-list");
  body.replaceChildren();
  $("#transaction-count").textContent = expenses.length;
  $("#empty-state").classList.toggle("hidden", expenses.length > 0);
  const total = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  $("#table-summary").textContent = expenses.length
    ? `${expenses.length} ${expenses.length === 1 ? "transaction" : "transactions"} · ${money(total)} total`
    : "No transactions to show";
  if (!expenses.length) return;

  for (const expense of expenses) {
    const row = document.createElement("tr");
    row.dataset.id = expense.id;
    const date = new Date(`${expense.date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    const icon = CATEGORY_ICONS[expense.category] || CATEGORY_ICONS.Other;
    row.innerHTML = `
      <td><div class="transaction-name"><span class="category-icon tint-${escapeHTML(expense.category)}"><i class="fa-solid ${icon}"></i></span><span><span class="transaction-title"></span><span class="transaction-note"></span></span></div></td>
      <td><span class="badge ${categoryClass(expense.category)}">${escapeHTML(expense.category)}</span></td>
      <td><span class="badge">${escapeHTML(expense.payment_mode)}</span></td>
      <td>${date}</td>
      <td class="amount-cell">${money2(expense.amount)}</td>
      <td><div class="row-actions"><button class="row-action edit" data-action="edit" aria-label="Edit expense"><i class="fa-solid fa-pen"></i></button><button class="row-action delete" data-action="delete" aria-label="Delete expense"><i class="fa-solid fa-trash"></i></button></div></td>`;
    row.querySelector(".transaction-title").textContent = expense.title;
    row.querySelector(".transaction-note").textContent = expense.notes || "";
    body.append(row);
  }
}
