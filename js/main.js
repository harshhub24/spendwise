/* App entry point: boot, auth routing, view switching, global events. */

import { state } from "./state.js";
import { $, toast, money, setServerStatus } from "./utils.js";
import { request, registerUnauthorizedHandler, clearSessionToken, readSessionToken } from "./api.js";
import { initTheme, applyTheme, currentTheme } from "./theme.js";
import { setGreeting, updateMonthLabel, shiftMonth, loadData, loadExpenses, refreshAll } from "./data.js";
import { updateCharts, destroyCharts } from "./charts.js";
import { showAuth, sessionExpired, bindAuth } from "./auth.js";
import { bindDialogs } from "./dialogs.js";

/* ---------- boot & auth routing ---------- */

async function boot() {
  initTheme();
  $("#year").textContent = new Date().getFullYear();
  try {
    const status = await request("/auth/status");
    setServerStatus("online", "Online");
    if (!status.setup_done) showAuth("setup");
    else if (!status.authenticated) {
      /* A token from an expired/reset session is useless — drop it. */
      if (readSessionToken()) clearSessionToken();
      showAuth("login");
    }
    else enterApp(status.username);
  } catch (error) {
    setServerStatus("offline", "Offline");
    showAuth("login", "Could not reach the server. Check your connection and try again.");
  }
}

function enterApp(username) {
  state.user = username;
  state.inApp = true;
  $("#auth-view").classList.add("hidden");
  $("#app-view").classList.remove("hidden");
  $("#avatar").textContent = username.charAt(0) || "?";
  $("#sidebar-username").textContent = username;
  setGreeting();
  state.month = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  updateMonthLabel();
  switchView("overview");
  loadData();
  setServerStatus("online", "Online");
}

/* ---------- views ---------- */

function switchView(name) {
  state.view = name;
  $("#view-overview").classList.toggle("hidden", name !== "overview");
  $("#view-transactions").classList.toggle("hidden", name !== "transactions");
  document.querySelectorAll("[data-nav]").forEach((button) => button.classList.toggle("active", button.dataset.nav === name));
  $("#view-title").textContent = name === "overview" ? "Dashboard" : "Transactions";
  window.scrollTo(0, 0);
  if (name === "transactions") loadExpenses().catch((error) => { if (error.status !== 401) toast(error.message, true); });
}

/* ---------- logout ---------- */

async function logout() {
  try { await request("/auth/logout", { method: "POST" }); } catch { /* clear locally regardless */ }
  clearSessionToken();
  state.user = null;
  state.summary = null;
  state.expenses = [];
  state.recent = [];
  destroyCharts();
  $("#login-username").value = "";
  $("#login-password").value = "";
  showAuth("login");
  toast("Signed out.");
}

/* ---------- events ---------- */

function bindEvents() {
  if (state.eventsBound) return;
  state.eventsBound = true;

  registerUnauthorizedHandler(sessionExpired);
  bindAuth(enterApp);
  bindDialogs();

  /* sidebar + bottom navigation */
  document.querySelectorAll("[data-nav]").forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.nav));
  });
  $("#view-all-btn").addEventListener("click", () => switchView("transactions"));
  $("#logout-button").addEventListener("click", logout);

  /* month navigation */
  $("#month-prev").addEventListener("click", () => shiftMonth(-1));
  $("#month-next").addEventListener("click", () => shiftMonth(1));

  /* quick add (smart parser) */
  $("#quick-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const input = $("#quick-text");
    const button = event.currentTarget.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const created = await request("/expenses/parse", { method: "POST", body: JSON.stringify({ text: input.value }) });
      input.value = "";
      toast(`Added “${created.title}” (${money(created.amount)}).`);
      await refreshAll();
    } catch (error) { if (error.status !== 401) toast(error.message, true); }
    finally { button.disabled = false; }
  });

  /* transactions filters */
  $("#search-input").addEventListener("input", () => {
    window.clearTimeout(state.searchTimer);
    state.searchTimer = window.setTimeout(() => loadExpenses().catch((error) => { if (error.status !== 401) toast(error.message, true); }), 280);
  });
  ["#category-filter", "#payment-filter", "#date-filter"].forEach((selector) => {
    $(selector).addEventListener("change", () => loadExpenses().catch((error) => { if (error.status !== 401) toast(error.message, true); }));
  });
  $("#export-inline").addEventListener("click", exportCSV);

  /* theme */
  $("#theme-toggle").addEventListener("click", () => {
    applyTheme(currentTheme() === "dark" ? "light" : "dark");
    updateCharts();
  });

  /* re-render charts on breakpoint cross (donut legend position) */
  window.addEventListener("resize", () => {
    window.clearTimeout(state.resizeTimer);
    state.resizeTimer = window.setTimeout(() => updateCharts(), 220);
  });

  /* username changed in account dialog → refresh greeting */
  document.addEventListener("spendwise:user-changed", setGreeting);
}

/* ---------- CSV export ---------- */

function exportCSV() {
  if (!state.expenses.length) {
    toast("There are no transactions to export.", true);
    return;
  }
  const fields = ["date", "title", "amount", "category", "payment_mode", "notes"];
  const quote = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const csv = [fields.join(","), ...state.expenses.map((expense) => fields.map((field) => quote(expense[field])).join(","))].join("\r\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
  link.download = `spendwise-expenses-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

/* ---------- go ---------- */

document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  boot();
});
