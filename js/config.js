/* Where the frontend finds the backend API.
   Split hosting (GitHub Pages frontend + Render backend):
     paste your Render service URL between the quotes, exactly as Render shows
     it — with https:// and WITHOUT a trailing slash, e.g.
     "https://spendwise-xxxx.onrender.com"
   Same-origin hosting (backend serves this frontend):
     leave it as "". */

window.SPENDWISE_API_BASE = "https://expense-tracker-backend-czei.onrender.com";

if (window.SPENDWISE_API_BASE.includes("PASTE_YOUR")) {
  console.warn(
    "[Spendwise] Setup needed: open js/config.js and paste your Render backend URL."
  );
}
