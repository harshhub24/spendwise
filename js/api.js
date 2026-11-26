/* Fetch wrapper for the Spendwise API.
   Works in both hosting modes:
   - same-origin (backend serves the frontend): session cookie
   - split hosting (GitHub Pages + Render): Bearer token in localStorage */

import { state } from "./state.js";

/* Trailing slashes would double up on "/auth/status"-style paths. */
export const API = (window.SPENDWISE_API_BASE || "").replace(/\/+$/, "");

const TOKEN_KEY = "spendwise_token";

let onUnauthorized = null;

/** Register the handler invoked when the session expires mid-app. */
export function registerUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

export function readSessionToken() {
  try {
    return window.localStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

export function setSessionToken(token) {
  if (!token) return;
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* private mode / storage disabled — the cookie flow still works same-origin */
  }
}

export function clearSessionToken() {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export async function request(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  const token = readSessionToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API}${path}`, { ...options, headers });
  if (!response.ok) {
    if (response.status === 401 && state?.inApp && !path.startsWith("/auth/login")) {
      clearSessionToken();
      onUnauthorized?.();
    }
    let message = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      message = Array.isArray(body.detail)
        ? body.detail.map((item) => item.msg).join(", ")
        : (body.detail || message);
    } catch { /* keep the status-based message */ }
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return response.status === 204 ? null : response.json();
}
