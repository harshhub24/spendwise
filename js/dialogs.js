/* All dialogs: expense add/edit, budget, account, confirm — plus the
   delegated click handlers that open them (recent list, table actions, nav). */

import { state } from "./state.js";
import { $, money, money2, dateOnly, toast } from "./utils.js";
import { request } from "./api.js";
import { refreshAll } from "./data.js";
import { showFormError } from "./auth.js";

/* ---------- openers ---------- */

export function openExpenseDialog(expense = null) {
  $("#expense-dialog-title").textContent = expense ? "Edit expense" : "Add expense";
  $("#expense-id").value = expense?.id || "";
  $("#expense-title").value = expense?.title || "";
  $("#expense-amount").value = expense?.amount ?? "";
  $("#expense-date").value = expense?.date || dateOnly(new Date());
  $("#expense-category").value = expense?.category || "Food";
  $("#expense-payment").value = expense?.payment_mode || "UPI";
  $("#expense-notes").value = expense?.notes || "";
  $("#expense-dialog").showModal();
}

export function openAccountDialog() {
  $("#account-username").value = state.user || "";
  $("#account-current").value = "";
  $("#account-password").value = "";
  $("#account-confirm").value = "";
  const box = $("#account-error");
  box.textContent = "";
  box.classList.add("hidden");
  $("#account-dialog").showModal();
}

/* ---------- confirm ---------- */

let confirmResolver = null;
let confirmAnswer = false;

export function confirmDialog({ title = "Are you sure?", message = "This action cannot be undone.", okLabel = "Delete" } = {}) {
  return new Promise((resolve) => {
    confirmResolver = resolve;
    confirmAnswer = false;
    $("#confirm-title").textContent = title;
    $("#confirm-message").textContent = message;
    $("#confirm-ok").innerHTML = `<i class="fa-solid fa-trash"></i> ${okLabel}`;
    $("#confirm-dialog").showModal();
  });
}

/* ---------- actions ---------- */

async function removeExpense(expense) {
  const confirmed = await confirmDialog({
    title: "Delete expense?",
    message: `“${expense.title}” (${money2(expense.amount)}) will be permanently removed.`
  });
  if (!confirmed) return;
  try {
    await request(`/expenses/${expense.id}`, { method: "DELETE" });
    toast("Expense deleted.");
    await refreshAll();
  } catch (error) { if (error.status !== 401) toast(error.message, true); }
}

function findExpense(id, list) {
  return list.find((expense) => String(expense.id) === String(id));
}

/* ---------- event binding ---------- */

export function bindDialogs() {
  /* close buttons + backdrop click */
  document.querySelectorAll(".close-dialog").forEach((button) => {
    button.addEventListener("click", () => button.closest("dialog").close());
  });
  document.querySelectorAll("dialog.modal").forEach((dialog) => {
    dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
  });

  /* confirm dialog wiring */
  $("#confirm-ok").addEventListener("click", () => { confirmAnswer = true; $("#confirm-dialog").close(); });
  $("#confirm-cancel").addEventListener("click", () => { confirmAnswer = false; $("#confirm-dialog").close(); });
  $("#confirm-dialog").addEventListener("close", () => {
    if (confirmResolver) { confirmResolver(confirmAnswer); confirmResolver = null; }
  });

  /* delegated: recent activity list → edit */
  $("#recent-list").addEventListener("click", (event) => {
    const item = event.target.closest("li[data-id]");
    if (!item) return;
    const expense = findExpense(item.dataset.id, state.recent);
    if (expense) openExpenseDialog(expense);
  });

  /* delegated: transactions table → edit / delete */
  $("#expense-list").addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    const row = event.target.closest("tr[data-id]");
    if (!button || !row) return;
    const expense = findExpense(row.dataset.id, state.expenses);
    if (!expense) return;
    if (button.dataset.action === "edit") openExpenseDialog(expense);
    else removeExpense(expense);
  });

  /* openers scattered around the shell */
  $("#detail-open").addEventListener("click", () => openExpenseDialog());
  $("#add-open").addEventListener("click", () => openExpenseDialog());
  $("#bottom-add").addEventListener("click", () => openExpenseDialog());
  $("#budget-open").addEventListener("click", () => {
    $("#budget-input").value = state.summary?.monthly_budget ?? "";
    $("#budget-dialog").showModal();
  });
  $("#bottom-account").addEventListener("click", openAccountDialog);

  /* expense form (create / update) */
  $("#expense-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const id = $("#expense-id").value;
    const payload = {
      title: $("#expense-title").value.trim(),
      amount: Number($("#expense-amount").value),
      category: $("#expense-category").value,
      payment_mode: $("#expense-payment").value,
      date: $("#expense-date").value,
      notes: $("#expense-notes").value.trim() || null
    };
    if (!payload.title || !payload.amount || !payload.date) {
      toast("Title, amount and date are required.", true);
      return;
    }
    try {
      await request(id ? `/expenses/${id}` : "/expenses", { method: id ? "PUT" : "POST", body: JSON.stringify(payload) });
      $("#expense-dialog").close();
      toast(id ? "Expense updated." : "Expense added.");
      await refreshAll();
    } catch (error) { if (error.status !== 401) toast(error.message, true); }
  });

  /* budget form */
  $("#budget-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const value = Number($("#budget-input").value);
    if (!value || value <= 0) { toast("Enter a valid budget amount.", true); return; }
    try {
      await request("/settings/budget", { method: "PUT", body: JSON.stringify({ monthly_budget: value }) });
      $("#budget-dialog").close();
      toast("Monthly budget updated.");
      await refreshAll();
    } catch (error) { if (error.status !== 401) toast(error.message, true); }
  });

  /* account form (change username / password) */
  $("#account-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const box = $("#account-error");
    box.textContent = "";
    box.classList.add("hidden");
    const currentPassword = $("#account-current").value;
    const username = $("#account-username").value.trim().toLowerCase();
    const newPassword = $("#account-password").value;
    const confirm = $("#account-confirm").value;
    if (!currentPassword) { showFormError("account", "Enter your current password to confirm."); return; }
    if (newPassword || confirm) {
      if (newPassword.length < 8) { showFormError("account", "New password must be at least 8 characters."); return; }
      if (newPassword !== confirm) { showFormError("account", "New passwords don't match."); return; }
    }
    const usernameChanged = username && username !== state.user;
    if (!usernameChanged && !newPassword) { showFormError("account", "Nothing to update — change your username or set a new password."); return; }
    if (usernameChanged && !/^[a-z0-9][a-z0-9._-]{2,23}$/.test(username)) { showFormError("account", "Username must be 3-24 characters: letters, numbers, dot, dash or underscore."); return; }
    try {
      const status = await request("/auth/credentials", {
        method: "PUT",
        body: JSON.stringify({
          current_password: currentPassword,
          username: usernameChanged ? username : null,
          new_password: newPassword || null
        })
      });
      state.user = status.username;
      $("#avatar").textContent = status.username.charAt(0);
      $("#sidebar-username").textContent = status.username;
      $("#account-current").value = "";
      $("#account-password").value = "";
      $("#account-confirm").value = "";
      $("#account-dialog").close();
      toast(newPassword ? "Account updated. Use your new password next time." : "Username updated.");
      /* re-render the greeting with the (possibly new) username */
      document.dispatchEvent(new CustomEvent("spendwise:user-changed"));
    } catch (error) {
      showFormError("account", error.message);
    }
  });
}
