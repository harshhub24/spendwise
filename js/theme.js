/* Light/dark theme with persistence. */

import { $ } from "./utils.js";

export function currentTheme() {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("spendwise-theme", theme);
  const toggle = $("#theme-toggle");
  if (toggle) toggle.innerHTML = `<i class="fa-solid ${theme === "dark" ? "fa-sun" : "fa-moon"}"></i>`;
}

export function initTheme() {
  applyTheme(localStorage.getItem("spendwise-theme") || "light");
}
