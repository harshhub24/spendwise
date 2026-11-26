/* Auth screens: one-time setup, sign in, session expiry. */

import { state } from "./state.js";
import { $, toast } from "./utils.js";
import { request, setSessionToken } from "./api.js";

export function showAuth(mode, notice = "") {
  state.inApp = false;
  $("#app-view").classList.add("hidden");
  $("#auth-view").classList.remove("hidden");
  $("#setup-panel").classList.toggle("hidden", mode !== "setup");
  $("#login-panel").classList.toggle("hidden", mode !== "login");
  clearAuthErrors();
  if (notice) {
    const box = mode === "setup" ? $("#setup-error") : $("#login-error");
    box.textContent = notice;
    box.classList.remove("hidden");
  }
  window.setTimeout(() => {
    const target = mode === "setup" ? $("#setup-username") : $("#login-username");
    if (target && window.innerWidth >= 640) target.focus();
  }, 60);
}

export function showFormError(which, message) {
  const box = which === "setup" ? $("#setup-error") : which === "login" ? $("#login-error") : $("#account-error");
  box.textContent = message;
  box.classList.remove("hidden");
}

function clearAuthErrors() {
  ["#setup-error", "#login-error"].forEach((selector) => {
    const box = $(selector);
    box.textContent = "";
    box.classList.add("hidden");
  });
}

/** Invoked by api.js whenever an authenticated call returns 401. */
export function sessionExpired() {
  if (!state.inApp) return;
  showAuth("login", "Your session expired. Please sign in again.");
  toast("Session expired — please sign in.", true);
}

export function bindAuth(onAuthenticated) {
  /* one-time setup */
  $("#setup-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    clearAuthErrors();
    const username = $("#setup-username").value.trim().toLowerCase();
    const password = $("#setup-password").value;
    const confirm = $("#setup-confirm").value;
    if (!/^[a-z0-9][a-z0-9._-]{2,23}$/.test(username)) {
      showFormError("setup", "Username must be 3-24 characters: letters, numbers, dot, dash or underscore.");
      return;
    }
    if (password.length < 8) { showFormError("setup", "Password must be at least 8 characters."); return; }
    if (password !== confirm) { showFormError("setup", "Passwords don't match. Please retype them."); return; }
    const button = $("#setup-submit");
    button.disabled = true;
    try {
      const status = await request("/auth/setup", { method: "POST", body: JSON.stringify({ username, password }) });
      setSessionToken(status.token);
      toast("Login created. Welcome to Spendwise!");
      onAuthenticated(status.username);
    } catch (error) {
      showFormError("setup", error.message);
    } finally { button.disabled = false; }
  });

  /* sign in */
  $("#login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    clearAuthErrors();
    const username = $("#login-username").value.trim().toLowerCase();
    const password = $("#login-password").value;
    if (!username || !password) { showFormError("login", "Enter your username and password."); return; }
    const button = $("#login-submit");
    button.disabled = true;
    try {
      const status = await request("/auth/login", { method: "POST", body: JSON.stringify({ username, password }) });
      setSessionToken(status.token);
      onAuthenticated(status.username);
    } catch (error) {
      showFormError("login", error.message);
    } finally { button.disabled = false; }
  });

  /* password strength hint */
  $("#setup-password").addEventListener("input", (event) => {
    const value = event.target.value;
    let score = 0;
    if (value.length >= 8) score += 1;
    if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
    if (/\d/.test(value)) score += 1;
    if (/[^A-Za-z0-9]/.test(value) || value.length >= 14) score += 1;
    const hint = $("#pw-strength");
    hint.classList.remove("strong", "weak");
    if (!value) { hint.textContent = "Use 8+ characters. A mix of letters and numbers is strongest."; return; }
    if (value.length < 8) { hint.textContent = "Too short — use at least 8 characters."; hint.classList.add("weak"); return; }
    if (score >= 3) { hint.textContent = "Strong password."; hint.classList.add("strong"); }
    else { hint.textContent = "Okay — mixing cases, numbers or symbols makes it stronger."; hint.classList.add("weak"); }
  });

  /* show/hide password buttons */
  document.querySelectorAll(".reveal").forEach((button) => {
    button.addEventListener("click", () => {
      const input = document.getElementById(button.dataset.reveal);
      if (!input) return;
      const reveal = input.type === "password";
      input.type = reveal ? "text" : "password";
      button.innerHTML = `<i class="fa-regular ${reveal ? "fa-eye-slash" : "fa-eye"}"></i>`;
    });
  });
}
