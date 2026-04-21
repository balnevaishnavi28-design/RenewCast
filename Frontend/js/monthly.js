// RenewCast AI — Monthly Energy Analysis (Tab 5)
// NOTE: Uses API_BASE from config.js (already loaded). No redeclaration.

// ── Seasonal solar multipliers by latitude band ─────────────────────────
// [Jan..Dec] — relative to annual average. Based on daylight hours + sun angle.
const SOLAR_FACTORS = {
    tropical:    [0.90,0.94,0.99,1.02,0.98,0.80,0.74,0.76,0.84,0.91,0.91,0.89],
    subtropical: [0.80,0.88,0.99,1.08,1.10,0.89,0.77,0.81,0.90,0.95,0.87,0.79],
    temperate:   [0.38,0.53,0.74,0.94,1.10,1.15,1.12,1.04,0.86,0.63,0.40,0.32],
    cold:        [0.16,0.30,0.57,0.83,1.07,1.18,1.14,0.97,0.69,0.40,0.20,0.12],
};
const WIND_FACTORS = {
    tropical:    [1.05,1.03,1.01,0.97,0.94,1.03,1.09,1.07,0.97,0.93,0.95,1.02],
    subtropical: [1.10,1.07,1.05,1.01,0.95,0.87,0.83,0.85,0.91,0.97,1.03,1.08],
    temperate:   [1.12,1.10,1.07,0.99,0.93,0.87,0.85,0.87,0.94,1.01,1.09,1.13],
    cold:        [1.15,1.11,1.09,1.01,0.91,0.83,0.81,0.85,0.95,1.05,1.11,1.15],
};
const MA_MONTHS      = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MA_MONTHS_FULL = ["January","February","March","April","May","June",
                        "July","August","September","October","November","December"];
const MA_DAYS        = [31,28,31,30,31,30,31,31,30,31,30,31];

// Each 400W panel → ~4 kWh/day base; each 2kW turbine → ~9.6 kWh/day base
const MA_KWH_PANEL   = 4.0;
const MA_KWH_TURBINE = 9.6;

function maGetBand(lat) {
    const a = Math.abs(lat);
    if (a <= 15) return "tropical";
    if (a <= 32) return "subtropical";
    if (a <= 55) return "temperate";
    return "cold";
}

function maComputeMonths(lat, panels, turbines) {
    const band = maGetBand(lat);
    const sf   = SOLAR_FACTORS[band];
    const wf   = WIND_FACTORS[band];
    return MA_MONTHS.map((name, i) => {
        const solar   = Math.round(MA_KWH_PANEL   * panels   * sf[i] * MA_DAYS[i]);
        const wind    = Math.round(MA_KWH_TURBINE  * turbines * wf[i] * MA_DAYS[i]);
        const total   = solar + wind;
        const savings = Math.round(total * 8);    // ₹8/kWh
        const co2kg   = Math.round(total * 0.82); // 0.82 kg CO₂/kWh India grid
        return { name, fullName: MA_MONTHS_FULL[i], days: MA_DAYS[i], solar, wind, total, savings, co2kg };
    });
}

function maMiniBar(val, maxVal, color) {
    const w = maxVal > 0 ? Math.min((val / maxVal) * 100, 100) : 0;
    return `<div class="ma-bar"><div class="ma-bar-fill" style="width:${w}%;background:${color}"></div></div>`;
}

function maRatingTag(total, avg) {
    const r = total / avg;
    if (r >= 1.12) return `<span class="ma-tag ma-peak">🔥 Peak</span>`;
    if (r >= 0.98) return `<span class="ma-tag ma-good">✅ Good</span>`;
    if (r >= 0.80) return `<span class="ma-tag ma-avg">🟡 Average</span>`;
    return               `<span class="ma-tag ma-low">📉 Low</span>`;
}

let maChartInst = null;
function maDrawChart(months) {
    const canvas = document.getElementById("ma-chart");
    if (!canvas || typeof Chart === "undefined") return;
    if (maChartInst) { maChartInst.destroy(); maChartInst = null; }
    maChartInst = new Chart(canvas.getContext("2d"), {
        type: "bar",
        data: {
            labels: months.map(m => m.name),
            datasets: [
                { label: "☀️ Solar (kWh)", data: months.map(m => m.solar),
                  backgroundColor: "rgba(251,146,60,0.75)", borderColor: "#f97316",
                  borderWidth: 1.5, borderRadius: 5, order: 2 },
                { label: "💨 Wind (kWh)", data: months.map(m => m.wind),
                  backgroundColor: "rgba(56,189,248,0.65)", borderColor: "#0ea5e9",
                  borderWidth: 1.5, borderRadius: 5, order: 2 },
                { label: "⚡ Total (kWh)", data: months.map(m => m.total),
                  type: "line", borderColor: "#6366f1", backgroundColor: "transparent",
                  borderWidth: 2.5, borderDash: [5,3], pointRadius: 4,
                  pointBackgroundColor: "#6366f1", tension: 0.35, order: 1 },
            ],
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: {
                legend: { position: "top" },
                tooltip: { callbacks: {
                    label: c => `${c.dataset.label}: ${Number(c.parsed.y).toLocaleString("en-IN")} kWh`
                }},
            },
            scales: {
                x: { grid: { color: "rgba(0,0,0,0.04)" } },
                y: { grid: { color: "rgba(0,0,0,0.04)" },
                     title: { display: true, text: "Energy (kWh)" },
                     ticks: { callback: v => v >= 1000 ? (v/1000).toFixed(1)+"k" : v } },
            },
        },
    });
}

function maRenderResult(cityName, lat, panels, turbines) {
    const months   = maComputeMonths(lat, panels, turbines);
    const band     = maGetBand(lat);
    const annSolar = months.reduce((a,m) => a+m.solar, 0);
    const annWind  = months.reduce((a,m) => a+m.wind,  0);
    const annTotal = months.reduce((a,m) => a+m.total, 0);
    const annSave  = months.reduce((a,m) => a+m.savings, 0);
    const annCO2   = months.reduce((a,m) => a+m.co2kg, 0);
    const avg      = annTotal / 12;
    const peakM    = months.reduce((a,b) => a.total > b.total ? a : b);
    const lowM     = months.reduce((a,b) => a.total < b.total ? a : b);
    const maxTotal = Math.max(...months.map(m => m.total));

    const fmt   = v => Number(v).toLocaleString("en-IN");
    const rupee = v => `₹${Number(v).toLocaleString("en-IN")}`;

    const tableRows = months.map(m => {
        const isPeak = m.name === peakM.name;
        const isLow  = m.name === lowM.name;
        return `<tr class="${isPeak ? "ma-row-peak" : isLow ? "ma-row-low" : ""}">
            <td><strong>${m.name}</strong></td>
            <td>${maMiniBar(m.solar,maxTotal,"#f97316")}<span class="mono">${fmt(m.solar)}</span></td>
            <td>${maMiniBar(m.wind, maxTotal,"#0ea5e9")}<span class="mono">${fmt(m.wind)}</span></td>
            <td>${maMiniBar(m.total,maxTotal,"#6366f1")}<span class="mono"><strong>${fmt(m.total)}</strong></span></td>
            <td>${maRatingTag(m.total, avg)}</td>
            <td class="mono">${rupee(m.savings)}</td>
        </tr>`;
    }).join("");

    const container = document.getElementById("monthly-result");
    container.innerHTML = `
        <div class="ma-location-badge">
            📍 <strong>${cityName}</strong> · Band: <strong style="text-transform:capitalize">${band}</strong>
            · ${panels} panel${panels!==1?"s":""} + ${turbines} turbine${turbines!==1?"s":""}
        </div>

        <div class="ma-consistent-box">
            <span class="ma-cb-icon">📌</span>
            <div>
                <strong>Why are these values the same every day?</strong><br>
                Monthly generation depends on how much sun and wind <strong>${cityName}</strong> gets
                across each season — not today's live weather. The city's position on Earth
                (latitude: <strong>${Math.abs(lat).toFixed(1)}° ${lat>=0?"N":"S"}</strong>, zone: <em>${band}</em>)
                determines this. Peak month is always <strong>${peakM.fullName}</strong>,
                lowest is <strong>${lowM.fullName}</strong> — same every year.
            </div>
        </div>

        <div class="ma-kpi-row">
            <div class="ma-kpi-card"><div class="ma-kpi-ico">☀️</div><div class="ma-kpi-val">${fmt(annSolar)}</div><div class="ma-kpi-lbl">Annual Solar (kWh)</div></div>
            <div class="ma-kpi-card"><div class="ma-kpi-ico">💨</div><div class="ma-kpi-val">${fmt(annWind)}</div><div class="ma-kpi-lbl">Annual Wind (kWh)</div></div>
            <div class="ma-kpi-card ma-kpi-highlight"><div class="ma-kpi-ico">⚡</div><div class="ma-kpi-val">${fmt(annTotal)}</div><div class="ma-kpi-lbl">Total Annual (kWh)</div></div>
            <div class="ma-kpi-card"><div class="ma-kpi-ico">💰</div><div class="ma-kpi-val">${rupee(annSave)}</div><div class="ma-kpi-lbl">Est. Annual Savings</div></div>
            <div class="ma-kpi-card"><div class="ma-kpi-ico">🌿</div><div class="ma-kpi-val">${fmt(Math.round(annCO2/1000))} t</div><div class="ma-kpi-lbl">CO₂ Avoided</div></div>
        </div>

        <div class="ma-insight-chips">
            <span class="ma-chip ma-chip-peak">🔥 Best: <strong>${peakM.fullName}</strong> — ${fmt(peakM.total)} kWh</span>
            <span class="ma-chip ma-chip-low">📉 Lowest: <strong>${lowM.fullName}</strong> — ${fmt(lowM.total)} kWh</span>
            <span class="ma-chip">📊 Monthly avg: <strong>${fmt(Math.round(avg))} kWh</strong></span>
        </div>

        <h4 class="res-sub-title" style="margin-top:26px">📊 Monthly Generation Chart</h4>
        <div class="ma-chart-box"><canvas id="ma-chart"></canvas></div>

        <h4 class="res-sub-title">📋 All 12 Months</h4>
        <div class="compare-table-wrap">
            <table class="mini-table">
                <thead>
                    <tr><th>Month</th><th>☀️ Solar (kWh)</th><th>💨 Wind (kWh)</th><th>⚡ Total (kWh)</th><th>Rating</th><th>💰 Savings</th></tr>
                </thead>
                <tbody>${tableRows}</tbody>
                <tfoot>
                    <tr>
                        <td><strong>Full Year</strong></td>
                        <td class="mono"><strong>${fmt(annSolar)}</strong></td>
                        <td class="mono"><strong>${fmt(annWind)}</strong></td>
                        <td class="mono"><strong>${fmt(annTotal)}</strong></td>
                        <td>—</td>
                        <td class="mono"><strong>${rupee(annSave)}</strong></td>
                    </tr>
                </tfoot>
            </table>
        </div>

        <p class="ma-footnote">
            📌 Each 400W panel ≈ ${MA_KWH_PANEL} kWh/day · Each 2kW turbine ≈ ${MA_KWH_TURBINE} kWh/day ·
            Values scaled by <strong>${cityName}'s ${band} climate zone</strong> seasonal patterns.
            Savings at ₹8/kWh. CO₂ at 0.82 kg/kWh. Actual output may vary ±15%.
        </p>`;

    container.style.display = "block";
    container.scrollIntoView({ behavior: "smooth", block: "nearest" });
    setTimeout(() => maDrawChart(months), 80);
}

// ── Button handler ──────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("monthly-btn");
    if (!btn) return;
    btn.addEventListener("click", async () => {
        const city     = (document.getElementById("ma-city")?.value || "").trim();
        const panels   = parseInt(document.getElementById("ma-panels")?.value)   || 10;
        const turbines = parseInt(document.getElementById("ma-turbines")?.value) || 1;
        if (!city) { alert("Please enter a city name."); return; }

        const origText  = btn.textContent;
        btn.disabled    = true;
        btn.textContent = "Loading…";

        try {
            // Use API_BASE from config.js (already declared globally)
            const res  = await fetch(`${API_BASE}/predict`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ city }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            maRenderResult(data.location.name, data.location.lat, panels, turbines);
        } catch (e) {
            const container = document.getElementById("monthly-result");
            container.innerHTML = `<div class="err-msg">❌ Error: ${e.message}</div>`;
            container.style.display = "block";
        } finally {
            btn.disabled    = false;
            btn.textContent = origText;
        }
    });
});
