/* Chart.js rendering: category donut with centre total + gradient trend bars. */

import { state, CHART_COLORS } from "./state.js";
import { $, money, money2 } from "./utils.js";
import { currentTheme } from "./theme.js";

let centerPluginRegistered = false;

function ensureCenterPlugin() {
  if (centerPluginRegistered || !window.Chart) return;
  Chart.register({
    id: "donutCenterTotal",
    afterDraw(chart) {
      if (chart.config.type !== "doughnut") return;
      const dataset = chart.data.datasets?.[0];
      if (!dataset || !dataset.data.length) return;
      const meta = chart.getDatasetMeta(0);
      if (!meta.data.length) return;
      const total = dataset.data.reduce((sum, value) => sum + Number(value || 0), 0);
      const styles = getComputedStyle(document.documentElement);
      const { ctx } = chart;
      const { x, y } = meta.data[0];
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "700 9px Inter";
      ctx.fillStyle = styles.getPropertyValue("--text-3").trim();
      ctx.fillText("MONTH TOTAL", x, y - 14);
      ctx.font = "700 21px 'Space Grotesk', Inter, sans-serif";
      ctx.fillStyle = styles.getPropertyValue("--text").trim();
      ctx.fillText(money(total), x, y + 8);
      ctx.restore();
    }
  });
  centerPluginRegistered = true;
}

function premiumTooltip() {
  return {
    backgroundColor: "rgba(10, 14, 22, .94)",
    padding: 10,
    cornerRadius: 10,
    titleFont: { family: "Inter", size: 11 },
    bodyFont: { family: "Inter", size: 12, weight: 600 },
    displayColors: false
  };
}

export function destroyCharts() {
  if (state.categoryChart) { state.categoryChart.destroy(); state.categoryChart = null; }
  if (state.trendChart) { state.trendChart.destroy(); state.trendChart = null; }
}

export function updateCharts() {
  if (!window.Chart || !state.summary) return;
  ensureCenterPlugin();
  const styles = getComputedStyle(document.documentElement);
  const textColor = styles.getPropertyValue("--text-2").trim();
  const gridColor = styles.getPropertyValue("--line").trim();
  const surfaceColor = styles.getPropertyValue("--surface").trim();
  const isDark = currentTheme() === "dark";
  const palette = CHART_COLORS[isDark ? "dark" : "light"];
  const chartFont = { family: "Inter" };
  const accent = isDark ? "#3ecf9c" : "#0a8a5f";

  /* donut — category breakdown */
  const entries = Object.entries(state.summary.category_breakdown || {});
  $("#category-empty").classList.toggle("hidden", entries.length > 0);
  if (state.categoryChart) state.categoryChart.destroy();
  state.categoryChart = new Chart($("#category-chart"), {
    type: "doughnut",
    data: {
      labels: entries.map(([name]) => name),
      datasets: [{
        data: entries.map(([, amount]) => amount),
        backgroundColor: entries.map(([name]) => palette[name] || palette.Other),
        borderWidth: 2,
        borderColor: surfaceColor,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "70%",
      plugins: {
        legend: {
          position: window.innerWidth < 680 ? "bottom" : "right",
          labels: { color: textColor, usePointStyle: true, pointStyle: "circle", boxWidth: 7, padding: 14, font: { ...chartFont, size: 11 } }
        },
        tooltip: {
          ...premiumTooltip(),
          callbacks: { label: (context) => ` ${context.label}: ${money2(context.raw)}` }
        }
      }
    }
  });

  /* trend — daily bars with a vertical gradient */
  const trend = state.summary.daily_totals || [];
  const trendTotal = trend.reduce((sum, point) => sum + point.amount, 0);
  $("#trend-empty").classList.toggle("hidden", trendTotal > 0);
  if (state.trendChart) state.trendChart.destroy();
  state.trendChart = new Chart($("#trend-chart"), {
    type: "bar",
    data: {
      labels: trend.map((point) => String(Number(point.date.slice(8, 10)))),
      datasets: [{
        label: "Spent",
        data: trend.map((point) => point.amount),
        backgroundColor: (context) => {
          const { chart } = context;
          const { ctx, chartArea } = chart;
          if (!chartArea) return accent;
          const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, accent);
          gradient.addColorStop(1, isDark ? "rgba(62, 207, 156, .22)" : "rgba(10, 138, 95, .25)");
          return gradient;
        },
        hoverBackgroundColor: palette.Health,
        borderRadius: 5,
        borderSkipped: false,
        maxBarThickness: 18
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 700, easing: "easeOutQuart" },
      plugins: {
        legend: { display: false },
        tooltip: {
          ...premiumTooltip(),
          callbacks: {
            title: (items) => {
              const point = trend[items[0].dataIndex];
              return point ? new Date(`${point.date}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }) : "";
            },
            label: (context) => ` ${money2(context.raw)}`
          }
        }
      },
      scales: {
        x: { grid: { display: false }, border: { display: false }, ticks: { color: textColor, font: { ...chartFont, size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 12 } },
        y: {
          beginAtZero: true, grid: { color: gridColor }, border: { display: false },
          ticks: { color: textColor, font: { ...chartFont, size: 10 }, maxTicksLimit: 6, callback: (value) => (value >= 1000 ? `₹${Math.round(value / 100) / 10}k` : `₹${value}`) }
        }
      }
    }
  });
}
