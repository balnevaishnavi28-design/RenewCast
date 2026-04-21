// RenewCast AI — Charts with interval selector + data table
let forecastChartInst = null;
let solarChartInst    = null;
let windChartInst     = null;
let _foreData         = null;   // store last forecast data for re-rendering

function formatLabel(ts) {
    const d = new Date(ts);
    return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,"0")}:00`;
}

// ── Interval filter ───────────────────────────────────────────────────────
// intervalHrs: 1=every slot, 2=every 2 slots, etc.
function filterByInterval(timestamps, solar, wind, intervalHrs) {
    const step = Math.max(1, Math.round(intervalHrs / 3));  // data is 3h resolution
    const filtTs = [], filtS = [], filtW = [];
    for (let i = 0; i < timestamps.length; i += step) {
        filtTs.push(timestamps[i]);
        filtS.push(solar[i]);
        filtW.push(wind[i]);
    }
    return { timestamps: filtTs, solar: filtS, wind: filtW };
}

function renderForecastChart(fore, intervalHrs) {
    _foreData   = fore;
    intervalHrs = intervalHrs || 3;

    const rawSolar = fore.solar.map(f => f.predicted_power_kw);
    const rawWind  = fore.wind.map(f  => f.predicted_power_kw);

    const { timestamps, solar: solarData, wind: windData } =
        filterByInterval(fore.timestamps, rawSolar, rawWind, intervalHrs);
    const totalData = solarData.map((s,i) => +(s + windData[i]).toFixed(3));
    const labels    = timestamps.map(formatLabel);

    // ── Main forecast chart ───────────────────────────────────────────
    const ctx1 = document.getElementById("forecastChart").getContext("2d");
    if (forecastChartInst) forecastChartInst.destroy();
    forecastChartInst = new Chart(ctx1, {
        type: "line",
        data: {
            labels,
            datasets: [
                { label:"Solar Power (kW)", data:solarData,
                  borderColor:"#f59e0b", backgroundColor:"rgba(245,158,11,0.12)",
                  fill:true, tension:0.4, pointRadius:4, pointHoverRadius:6 },
                { label:"Wind Power (kW)",  data:windData,
                  borderColor:"#06b6d4", backgroundColor:"rgba(6,182,212,0.10)",
                  fill:true, tension:0.4, pointRadius:4, pointHoverRadius:6 },
                { label:"Total (kW)",       data:totalData,
                  borderColor:"#6366f1", backgroundColor:"transparent",
                  borderDash:[6,3], tension:0.4, pointRadius:0 },
            ],
        },
        options: {
            responsive:true, maintainAspectRatio:false,
            interaction:{ mode:"index", intersect:false },
            plugins:{
                legend:{ position:"top" },
                tooltip:{ callbacks:{ label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)} kW` } }
            },
            scales:{
                x:{ grid:{color:"rgba(0,0,0,0.05)"}, ticks:{maxRotation:45} },
                y:{ grid:{color:"rgba(0,0,0,0.05)"},
                    title:{display:true,text:"Power (kW)"} },
            },
        },
    });

    // ── Solar mini line chart (same style as wind) ───────────────────
    const ctx2 = document.getElementById("solarChart").getContext("2d");
    if (solarChartInst) solarChartInst.destroy();
    solarChartInst = new Chart(ctx2, {
        type: "line",
        data: {
            labels,
            datasets:[{ label:"Solar (kW)", data:solarData,
                borderColor:"#f59e0b",
                backgroundColor:"rgba(245,158,11,0.15)",
                fill:true, tension:0.4, pointRadius:2,
                pointHoverRadius:4,
                borderWidth:2 }],
        },
        options:{
            responsive:true, maintainAspectRatio:false,
            interaction:{ mode:"index", intersect:false },
            plugins:{
                legend:{display:false},
                tooltip:{ callbacks:{ label: ctx => `Solar: ${ctx.parsed.y.toFixed(2)} kW` } }
            },
            scales:{
                x:{display:false},
                y:{grid:{color:"rgba(0,0,0,0.04)"},
                   ticks:{ font:{ size:10 } }}
            },
        },
    });

    // ── Wind mini line chart ──────────────────────────────────────────
    const ctx3 = document.getElementById("windChart").getContext("2d");
    if (windChartInst) windChartInst.destroy();
    windChartInst = new Chart(ctx3, {
        type: "line",
        data: {
            labels,
            datasets:[{ label:"Wind (kW)", data:windData,
                borderColor:"#06b6d4", backgroundColor:"rgba(6,182,212,0.15)",
                fill:true, tension:0.4, pointRadius:2 }],
        },
        options:{
            responsive:true, maintainAspectRatio:false,
            plugins:{ legend:{display:false} },
            scales:{ x:{display:false}, y:{grid:{color:"rgba(0,0,0,0.04)"}} },
        },
    });

    // ── Data table ────────────────────────────────────────────────────
    buildForecastTable(timestamps, solarData, windData, totalData);
}

function buildForecastTable(timestamps, solarData, windData, totalData) {
    const tbody = document.getElementById("forecast-table-body");
    const tbl   = document.getElementById("forecast-data-table");
    if (!tbody || !tbl) return;
    tbody.innerHTML = timestamps.map((ts, i) => {
        const s = solarData[i], w = windData[i], t = totalData[i];
        const domSrc = s > w ? "☀️ Solar" : w > 0 ? "💨 Wind" : "–";
        return `<tr>
            <td>${formatLabel(ts)}</td>
            <td class="mono">${s.toFixed(2)}</td>
            <td class="mono">${w.toFixed(2)}</td>
            <td class="mono"><strong>${t.toFixed(2)}</strong></td>
            <td>${domSrc}</td>
        </tr>`;
    }).join("");
    tbl.style.display = "block";
}

// ── Interval selector buttons ─────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".interval-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".interval-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            if (_foreData) renderForecastChart(_foreData, parseInt(btn.dataset.interval));
        });
    });

    // Table toggle
    const toggleBtn = document.getElementById("toggle-table-btn");
    if (toggleBtn) {
        toggleBtn.addEventListener("click", () => {
            const tbl = document.getElementById("forecast-data-table");
            if (!tbl) return;
            const hidden = tbl.style.display === "none";
            tbl.style.display = hidden ? "block" : "none";
            toggleBtn.textContent = hidden ? "Hide Data Table ▲" : "Show Data Table ▼";
        });
    }
});
