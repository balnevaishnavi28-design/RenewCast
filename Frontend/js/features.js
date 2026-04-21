// RenewCast AI — Feature Tabs
// Tab 1: Multi-City Comparison  (no winner tags — visual bars)
// Tab 2: Household Calculator   (with solar panels table)
// Tab 3: Industrial Calculator  (with panels + turbines + unit breakdown table)
// Tab 4: Best Time Advisor      (best hours to run heavy appliances)

// ── Tab switching ─────────────────────────────────────────────────────────
document.querySelectorAll(".ftab").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".ftab").forEach(b => b.classList.remove("active"));
        document.querySelectorAll(".ftab-panel").forEach(p => p.classList.remove("active"));
        btn.classList.add("active");
        document.getElementById(`panel-${btn.dataset.ftab}`).classList.add("active");
    });
});

// ── Shared helpers ────────────────────────────────────────────────────────
function setLoading(btn, on) {
    btn.disabled = on;
    if (on) btn.setAttribute("data-orig", btn.textContent);
    else btn.textContent = btn.getAttribute("data-orig") || btn.textContent;
    if (on) btn.textContent = "Loading…";
}
function showPanelResult(id, html) {
    const el = document.getElementById(id);
    el.innerHTML = html;
    el.style.display = "block";
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
function kw(v)   { return `<span class="mono">${Number(v).toFixed(2)}</span> kW`; }
function pct(v)  { return `<span class="mono">${Number(v).toFixed(1)}</span>%`; }
function inr(v)  { return `₹${Number(v).toLocaleString("en-IN")}`; }

function coverageBar(val, max100) {
    const w = Math.min(val, 100);
    const c = w >= 75 ? "#10b981" : w >= 40 ? "#f59e0b" : "#ef4444";
    return `<div class="cov-bar-wrap">
        <div class="cov-bar-track"><div class="cov-bar-fill" style="width:${w}%;background:${c}"></div></div>
        <span class="cov-pct mono">${val.toFixed(1)}%</span></div>`;
}

function progressBar(val, maxVal, color) {
    const w = maxVal > 0 ? Math.min(val / maxVal * 100, 100) : 0;
    return `<div class="mini-bar-track"><div class="mini-bar-fill" style="width:${w}%;background:${color}"></div></div>`;
}

// ══════════════════════════════════════════════════════════════════════════
// TAB 1 — MULTI-CITY COMPARISON (up to 3 cities, no winner tags)
// ══════════════════════════════════════════════════════════════════════════
function addCompareCity() {
    const container = document.getElementById("compare-city-list");
    const count = container.querySelectorAll(".compare-city-input").length;
    if (count >= 3) return;
    const div = document.createElement("div");
    div.className = "compare-city-row";
    div.innerHTML = `
        <div class="city-badge">City ${count + 1}</div>
        <div class="input-wrap">
            <svg class="input-icon" width="15" height="15" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 0C6.13 0 3 3.13 3 7c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
            <input type="text" class="ifield compare-city-input" placeholder="Enter city name">
        </div>
        <button class="remove-city-btn" onclick="this.parentElement.remove()">✕</button>`;
    container.appendChild(div);
    if (container.querySelectorAll(".compare-city-input").length >= 3)
        document.getElementById("add-city-btn").disabled = true;
}
window.addCompareCity = addCompareCity;

document.getElementById("add-city-btn")?.addEventListener("click", () => {
    addCompareCity();
});

const compareBtn = document.getElementById("compare-btn");
compareBtn?.addEventListener("click", async () => {
    const cities = [...document.querySelectorAll(".compare-city-input")]
        .map(i => i.value.trim()).filter(Boolean);
    if (cities.length < 2) return alert("Enter at least 2 city names.");
    setLoading(compareBtn, true);
    try {
        const res = await fetch(`${API_BASE}/compare`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cities }),
        });
        const d = await res.json();
        if (d.error) throw new Error(d.error);

        const maxSolar = Math.max(...d.cities.map(c => c.solar_kw));
        const maxWind  = Math.max(...d.cities.map(c => c.wind_kw));
        const maxTotal = Math.max(...d.cities.map(c => c.total_kw));

        // Metric comparison table
        const metricRows = [
            { label: "☀️ Solar Power (kW)", key: "solar_kw",     max: maxSolar, color: "#f59e0b" },
            { label: "💨 Wind Power (kW)",  key: "wind_kw",      max: maxWind,  color: "#06b6d4" },
            { label: "⚡ Total Output (kW)", key: "total_kw",    max: maxTotal, color: "#6366f1" },
            { label: "🌡️ Temperature",       key: "temperature",  max: null,    unit:"°C"       },
            { label: "🌬️ Wind Speed",        key: "wind_speed",   max: null,    unit:"m/s"      },
            { label: "☁️ Cloud Cover",       key: "cloud_cover",  max: null,    unit:"%"        },
            { label: "💧 Humidity",          key: "humidity",     max: null,    unit:"%"        },
            { label: "🔆 Solar Irradiance",  key: "irradiance",   max: null,    unit:"W/m²"     },
        ];

        const cityHeaders = d.cities.map(c =>
            `<th><div class="city-th">${c.name}</div><div class="city-coord">${c.lat.toFixed(2)}°N ${c.lon.toFixed(2)}°E</div></th>`
        ).join("");

        const tableRows = metricRows.map(m => {
            const cells = d.cities.map(c => {
                const val = c[m.key];
                if (m.max != null) {
                    return `<td>${progressBar(val, m.max, m.color)}<span class="mono">${val.toFixed(2)} kW</span></td>`;
                }
                return `<td class="mono">${val}${m.unit||""}</td>`;
            }).join("");
            return `<tr><td class="metric-label-cell">${m.label}</td>${cells}</tr>`;
        }).join("");

        // Radar-style summary cards
        const summaryCards = d.cities.map((c, i) => {
            const colors = ["#f97316","#3b82f6","#10b981"];
            const gradients = [
                "linear-gradient(135deg,#fff8f0,#fef3c7)",
                "linear-gradient(135deg,#eff6ff,#dbeafe)",
                "linear-gradient(135deg,#f0fdf4,#dcfce7)"
            ];
            return `<div class="compare-summary-card" style="border-top:4px solid ${colors[i]};background:${gradients[i]}">
                <div class="csc-city">${c.name}</div>
                <div class="csc-grid">
                    <div class="csc-item"><span>☀️ Solar</span><strong>${c.solar_kw.toFixed(2)} kW</strong></div>
                    <div class="csc-item"><span>💨 Wind</span><strong>${c.wind_kw.toFixed(2)} kW</strong></div>
                    <div class="csc-item"><span>⚡ Total</span><strong>${c.total_kw.toFixed(2)} kW</strong></div>
                    <div class="csc-item"><span>☀️ Efficiency</span><strong>${c.solar_eff_pct}%</strong></div>
                    <div class="csc-item"><span>🌬️ Wind Regime</span><strong>${c.wind_regime}</strong></div>
                    <div class="csc-item"><span>🌡️ Temp</span><strong>${c.temperature}°C</strong></div>
                </div>
            </div>`;
        }).join("");

        showPanelResult("compare-result", `
            <div class="compare-summary-row">${summaryCards}</div>
            <h4 class="res-sub-title">📊 Side-by-Side Metric Comparison</h4>
            <div class="compare-table-wrap">
                <table class="compare-table">
                    <thead><tr><th>Metric</th>${cityHeaders}</tr></thead>
                    <tbody>${tableRows}</tbody>
                </table>
            </div>
            <div class="compare-insight">
                <strong>💡 Insight:</strong>
                ${(() => {
                    const best = d.cities.reduce((a,b) => a.total_kw > b.total_kw ? a : b);
                    const worst = d.cities.reduce((a,b) => a.total_kw < b.total_kw ? a : b);
                    const diff = (best.total_kw - worst.total_kw).toFixed(2);
                    return `<strong>${best.name}</strong> has the highest renewable energy output at <strong>${best.total_kw.toFixed(2)} kW</strong>,
                    which is <strong>${diff} kW</strong> more than <strong>${worst.name}</strong> right now.
                    ${best.solar_kw > best.wind_kw
                        ? "Solar is the dominant energy source in this location."
                        : "Wind is the dominant energy source in this location."}`;
                })()}
            </div>`);
    } catch (e) {
        showPanelResult("compare-result", `<div class="err-msg">❌ ${e.message}</div>`);
    } finally { setLoading(compareBtn, false); }
});


// ══════════════════════════════════════════════════════════════════════════
// TAB 2 — HOUSEHOLD CALCULATOR
// ══════════════════════════════════════════════════════════════════════════
function buildApplianceGrid() {
    const grid = document.getElementById("appliance-grid");
    if (!grid) return;
    grid.innerHTML = "";
    Object.entries(APPLIANCE_CATALOG).forEach(([key, ap]) => {
        const card = document.createElement("div");
        card.className = "appliance-card";
        card.innerHTML = `
            <div class="ap-icon">${ap.icon}</div>
            <div class="ap-name">${ap.label}</div>
            <div class="ap-watts">${ap.watts} W</div>
            <div class="ap-qty">
                <button class="qty-btn" onclick="changeQty('${key}',-1)">−</button>
                <span class="qty-val" id="qty-${key}">0</span>
                <button class="qty-btn" onclick="changeQty('${key}',+1)">+</button>
            </div>`;
        grid.appendChild(card);
    });
}
window.changeQty = (key, delta) => {
    const el = document.getElementById(`qty-${key}`);
    if (el) el.textContent = Math.max(0, (parseInt(el.textContent)||0) + delta);
};
buildApplianceGrid();

const hhBtn = document.getElementById("household-btn");
hhBtn?.addEventListener("click", async () => {
    const city = document.getElementById("hh-city")?.value.trim();
    if (!city) return alert("Please enter a city name.");
    const appliances = {};
    Object.keys(APPLIANCE_CATALOG).forEach(key => {
        const qty = parseInt(document.getElementById(`qty-${key}`)?.textContent) || 0;
        if (qty > 0) appliances[key] = qty;
    });
    if (!Object.keys(appliances).length) return alert("Please select at least one appliance.");
    const num_houses  = parseInt(document.getElementById("hh-num-houses")?.value) || 1;
    const daily_hours = parseFloat(document.getElementById("hh-daily-hours")?.value) || 8;

    setLoading(hhBtn, true);
    try {
        const res = await fetch(`${API_BASE}/household`, {
            method:"POST", headers:{"Content-Type":"application/json"},
            body: JSON.stringify({ city, appliances, num_houses, daily_hours }),
        });
        const d = await res.json();
        if (d.error) throw new Error(d.error);

        const s  = d.solar_sizing;
        const wz = d.wind_sizing;

        const appRows = d.input_appliances.map(a => `
            <tr>
                <td>${a.appliance}</td>
                <td class="mono">${a.quantity}</td>
                <td class="mono">${a.power_w} W</td>
                <td class="mono">${a.total_w} W</td>
                <td class="mono">${a.daily_kwh} kWh</td>
            </tr>`).join("");

        showPanelResult("household-result", `
            <div class="result-grid-3">
                <div class="res-card solar-res">
                    <div class="res-ico">🏠</div>
                    <div class="res-label">Houses Supported</div>
                    <div class="res-val"><span class="mono">${d.houses_supported}</span></div>
                    <div class="res-sub">of ${d.num_houses} requested</div>
                </div>
                <div class="res-card wind-res">
                    <div class="res-ico">⚡</div>
                    <div class="res-label">Energy Generated</div>
                    <div class="res-val">${kw(d.total_generated_kw)}</div>
                    <div class="res-sub">Need: ${kw(d.total_load_kw)}</div>
                </div>
                <div class="res-card total-res">
                    <div class="res-ico">${d.status==="sufficient"?"✅":"⚠️"}</div>
                    <div class="res-label">Coverage</div>
                    <div class="res-val">${pct(d.coverage_pct)}</div>
                    <div class="res-sub">${d.status==="sufficient"?"Sufficient":"Insufficient"}</div>
                </div>
            </div>
            ${coverageBar(d.coverage_pct)}
            ${d.surplus_kw>0?`<div class="surplus-msg">✅ Surplus <strong>${d.surplus_kw.toFixed(2)} kW</strong> — can feed back to grid</div>`:""}
            ${d.deficit_kw>0?`<div class="deficit-msg">⚠️ Deficit <strong>${d.deficit_kw.toFixed(2)} kW</strong> — additional source needed</div>`:""}

            <h4 class="res-sub-title">🔌 Appliance Load Breakdown (per house)</h4>
            <table class="mini-table">
                <thead><tr><th>Appliance</th><th>Qty</th><th>Unit Power</th><th>Total Power</th><th>Daily Energy</th></tr></thead>
                <tbody>${appRows}</tbody>
                <tfoot><tr>
                    <td colspan="3"><strong>Total per house</strong></td>
                    <td class="mono"><strong>${(d.load_per_house_kw*1000).toFixed(0)} W</strong></td>
                    <td class="mono"><strong>${(d.load_per_house_kw*d.daily_hours).toFixed(2)} kWh</strong></td>
                </tr></tfoot>
            </table>

            <h4 class="res-sub-title">☀️ Solar Panel Sizing (for all ${d.num_houses} houses)</h4>
            <table class="mini-table sizing-table">
                <thead><tr><th>Parameter</th><th>Value</th><th>Details</th></tr></thead>
                <tbody>
                    <tr><td>Total Daily Energy Needed</td><td class="mono">${d.daily_kwh_total.toFixed(2)} kWh</td><td>${d.num_houses} houses × ${(d.load_per_house_kw*d.daily_hours).toFixed(2)} kWh</td></tr>
                    <tr><td>Panel Rating</td><td class="mono">${s.panel_watt} W per panel</td><td>Standard monocrystalline, ${(s.panel_watt/1000*100).toFixed(0)}% area efficiency</td></tr>
                    <tr><td>Energy per Panel / Day</td><td class="mono">${s.kwh_per_panel_day} kWh</td><td>At 5.5 peak sun hours (India avg)</td></tr>
                    <tr class="highlight-row"><td><strong>Panels Required (all houses)</strong></td><td class="mono"><strong>${s.panels_needed} panels</strong></td><td>${s.panels_per_house} panels per house</td></tr>
                    <tr><td>Total Panel Area</td><td class="mono">${s.total_area_m2} m²</td><td>At 1.6 m² per panel</td></tr>
                    <tr><td>System Capacity</td><td class="mono">${s.system_kw} kWp</td><td>Total installed kilo-Watt-peak</td></tr>
                    <tr><td>Estimated Installation Cost</td><td class="mono">${inr(s.est_cost_inr)}</td><td>At ₹25,000 per panel (installed)</td></tr>
                    <tr><td>Monthly Electricity Saving</td><td class="mono">${inr(s.monthly_saving_inr)}</td><td>At ₹8.5/kWh average tariff</td></tr>
                    <tr class="highlight-row"><td><strong>Payback Period</strong></td><td class="mono"><strong>${s.payback_years} years</strong></td><td>Based on monthly savings</td></tr>
                </tbody>
            </table>

            <h4 class="res-sub-title">💨 Supplementary Wind Sizing</h4>
            <table class="mini-table sizing-table">
                <thead><tr><th>Parameter</th><th>Value</th><th>Details</th></tr></thead>
                <tbody>
                    <tr><td>Small Turbine Rating</td><td class="mono">${wz.turbine_kw} kW</td><td>Residential rooftop turbine</td></tr>
                    <tr><td>Energy per Turbine / Day</td><td class="mono">${wz.kwh_per_turbine_day} kWh</td><td>At 35% capacity factor, 6 eff. hrs</td></tr>
                    <tr class="highlight-row"><td><strong>Turbines Required</strong></td><td class="mono"><strong>${wz.turbines_needed}</strong></td><td>If wind supplement is preferred</td></tr>
                </tbody>
            </table>`);
    } catch(e) {
        showPanelResult("household-result",`<div class="err-msg">❌ ${e.message}</div>`);
    } finally { setLoading(hhBtn, false); }
});


// ══════════════════════════════════════════════════════════════════════════
// TAB 3 — INDUSTRIAL CALCULATOR
// ══════════════════════════════════════════════════════════════════════════
const indBtn = document.getElementById("industrial-btn");
indBtn?.addEventListener("click", async () => {
    const city        = document.getElementById("ind-city")?.value.trim();
    const sector      = document.getElementById("ind-sector")?.value;
    const num_units   = parseInt(document.getElementById("ind-num-units")?.value) || 1;
    const shift_hours = parseInt(document.getElementById("ind-shift-hours")?.value) || 8;
    if (!city) return alert("Please enter a city name.");

    setLoading(indBtn, true);
    try {
        const res = await fetch(`${API_BASE}/industrial`, {
            method:"POST", headers:{"Content-Type":"application/json"},
            body: JSON.stringify({ city, sector, num_units, shift_hours }),
        });
        const d = await res.json();
        if (d.error) throw new Error(d.error);

        const s  = d.solar_sizing;
        const wz = d.wind_sizing;

        const unitRows = d.unit_breakdown.map(u => `
            <tr>
                <td class="mono">Unit ${u.unit_no}</td>
                <td class="mono">${u.load_kw} kW</td>
                <td class="mono">${u.covered_kw} kW</td>
                <td>${progressBar(u.coverage_pct, 100, u.coverage_pct>=75?"#10b981":u.coverage_pct>=40?"#f59e0b":"#ef4444")} <span class="mono">${u.coverage_pct}%</span></td>
                <td class="mono ${u.deficit_kw>0?"text-red":""}">${u.deficit_kw > 0 ? u.deficit_kw+" kW" : "–"}</td>
            </tr>`).join("");

        showPanelResult("industrial-result", `
            <div class="result-grid-3">
                <div class="res-card solar-res">
                    <div class="res-ico">🏭</div>
                    <div class="res-label">Units Powered</div>
                    <div class="res-val"><span class="mono">${d.units_powered}</span></div>
                    <div class="res-sub">${d.sector_label}</div>
                </div>
                <div class="res-card wind-res">
                    <div class="res-ico">⚡</div>
                    <div class="res-label">Coverage</div>
                    <div class="res-val">${pct(d.coverage_pct)}</div>
                    <div class="res-sub">of ${d.total_load_kw} kW demand</div>
                </div>
                <div class="res-card total-res">
                    <div class="res-ico">🌿</div>
                    <div class="res-label">CO₂ Saved</div>
                    <div class="res-val"><span class="mono">${d.co2_saved_kg_hr}</span> <small>kg/hr</small></div>
                    <div class="res-sub">${inr(d.daily_saving_inr)}/day saved</div>
                </div>
            </div>
            ${coverageBar(d.coverage_pct)}
            ${d.surplus_kw>0?`<div class="surplus-msg">✅ Surplus <strong>${d.surplus_kw.toFixed(2)} kW</strong> — available for other units</div>`:""}
            ${d.deficit_kw>0?`<div class="deficit-msg">⚠️ Deficit <strong>${d.deficit_kw.toFixed(2)} kW</strong> — grid backup required</div>`:""}

            <h4 class="res-sub-title">🏭 Unit-by-Unit Coverage Table</h4>
            <table class="mini-table">
                <thead><tr><th>Unit</th><th>Cumulative Load</th><th>RE Covered</th><th>Coverage %</th><th>Grid Deficit</th></tr></thead>
                <tbody>${unitRows}</tbody>
                <tfoot><tr>
                    <td colspan="2"><strong>Total</strong></td>
                    <td class="mono"><strong>${d.total_generated_kw.toFixed(2)} kW</strong></td>
                    <td><strong>${d.coverage_pct.toFixed(1)}%</strong></td>
                    <td class="mono"><strong>${d.deficit_kw.toFixed(2)} kW</strong></td>
                </tr></tfoot>
            </table>

            <h4 class="res-sub-title">☀️ Solar Installation Sizing</h4>
            <table class="mini-table sizing-table">
                <thead><tr><th>Parameter</th><th>Value</th><th>Details</th></tr></thead>
                <tbody>
                    <tr><td>Daily Energy Required</td><td class="mono">${d.daily_energy_kwh.toFixed(1)} kWh</td><td>${d.total_load_kw} kW × ${d.shift_hours} shift hrs</td></tr>
                    <tr><td>Panel Rating</td><td class="mono">${s.panel_watt} W per panel</td><td>Commercial monocrystalline panels</td></tr>
                    <tr><td>Energy per Panel / Day</td><td class="mono">${s.kwh_per_panel} kWh</td><td>At 5.5 peak sun hours, 80% efficiency</td></tr>
                    <tr class="highlight-row"><td><strong>Panels Required</strong></td><td class="mono"><strong>${s.panels_needed} panels</strong></td><td>Total for full coverage</td></tr>
                    <tr><td>Total Roof/Land Area</td><td class="mono">${s.total_area_m2} m²</td><td>At 1.6 m² per panel</td></tr>
                    <tr><td>Installed Capacity</td><td class="mono">${s.system_kw} kWp</td><td>kilo-Watt-peak</td></tr>
                    <tr><td>Estimated CAPEX</td><td class="mono">${inr(s.est_cost_inr)}</td><td>₹40,000 per panel (commercial installation)</td></tr>
                    <tr><td>Daily Savings</td><td class="mono">${inr(s.daily_saving_inr)}</td><td>At ₹8.5/kWh industrial tariff</td></tr>
                    <tr class="highlight-row"><td><strong>Payback Period</strong></td><td class="mono"><strong>${s.payback_years} years</strong></td><td>Based on daily operational savings</td></tr>
                </tbody>
            </table>

            <h4 class="res-sub-title">💨 Wind Turbine Sizing (Large Industrial)</h4>
            <table class="mini-table sizing-table">
                <thead><tr><th>Parameter</th><th>Value</th><th>Details</th></tr></thead>
                <tbody>
                    <tr><td>Turbine Rating</td><td class="mono">${wz.turbine_kw.toLocaleString()} kW</td><td>Large commercial wind turbine (2 MW class)</td></tr>
                    <tr><td>Energy per Turbine / Day</td><td class="mono">${wz.kwh_per_turbine} kWh</td><td>At 35% capacity factor, 8 eff. hrs/day</td></tr>
                    <tr class="highlight-row"><td><strong>Turbines Required</strong></td><td class="mono"><strong>${wz.turbines_needed}</strong></td><td>For full wind coverage</td></tr>
                </tbody>
            </table>

            <div class="ind-summary-strip">
                <div class="iss-item"><span>Sector</span><strong>${d.sector_label}</strong></div>
                <div class="iss-item"><span>Units</span><strong>${d.num_units}</strong></div>
                <div class="iss-item"><span>Shift</span><strong>${d.shift_hours} hrs/day</strong></div>
                <div class="iss-item"><span>Daily kWh</span><strong>${d.daily_energy_kwh}</strong></div>
                <div class="iss-item"><span>CO₂/hr</span><strong>${d.co2_saved_kg_hr} kg</strong></div>
                <div class="iss-item"><span>Annual Saving</span><strong>${inr(d.daily_saving_inr*365)}</strong></div>
            </div>`);
    } catch(e) {
        showPanelResult("industrial-result",`<div class="err-msg">❌ ${e.message}</div>`);
    } finally { setLoading(indBtn, false); }
});


// ══════════════════════════════════════════════════════════════════════════
// TAB 4 — BEST TIME ADVISOR
// ══════════════════════════════════════════════════════════════════════════
function buildHeavyApplianceList() {
    const container = document.getElementById("heavy-appliance-list");
    if (!container) return;
    container.innerHTML = "";
    const HEAVY = {
        washing_machine : { label:"Washing Machine", watts:500,  icon:"🫧" },
        ac              : { label:"Air Conditioner",  watts:1500, icon:"❄️" },
        geyser          : { label:"Water Heater",     watts:2000, icon:"🚿" },
        dishwasher      : { label:"Dishwasher",       watts:1200, icon:"🍽️" },
        microwave       : { label:"Microwave Oven",   watts:900,  icon:"🍲" },
        iron            : { label:"Clothes Iron",     watts:1000, icon:"👔" },
        ev_charger      : { label:"EV Charger",       watts:3300, icon:"🔋" },
        pump            : { label:"Water Pump",       watts:750,  icon:"💧" },
    };
    Object.entries(HEAVY).forEach(([key, ap]) => {
        const label = document.createElement("label");
        label.className = "heavy-ap-label";
        label.innerHTML = `
            <input type="checkbox" class="heavy-ap-chk" value="${key}">
            <span class="heavy-ap-icon">${ap.icon}</span>
            <span class="heavy-ap-name">${ap.label}</span>
            <span class="heavy-ap-watts">${ap.watts} W</span>`;
        container.appendChild(label);
    });
}
buildHeavyApplianceList();

const btBtn = document.getElementById("besttime-btn");
btBtn?.addEventListener("click", async () => {
    const city = document.getElementById("bt-city")?.value.trim();
    if (!city) return alert("Please enter a city name.");
    const appliances = [...document.querySelectorAll(".heavy-ap-chk:checked")].map(c => c.value);
    if (!appliances.length) return alert("Select at least one appliance.");
    const duration = parseFloat(document.getElementById("bt-duration")?.value) || 1;

    setLoading(btBtn, true);
    try {
        const res = await fetch(`${API_BASE}/besttime`, {
            method:"POST", headers:{"Content-Type":"application/json"},
            body: JSON.stringify({ city, appliances, duration_hrs: duration }),
        });
        const d = await res.json();
        if (d.error) throw new Error(d.error);

        const appList = d.selected_apps.map(a =>
            `<span class="feat-chip">${a.label} (${a.watts}W)</span>`).join(" ");

        // Best slots table
        const bestRows = d.best_slots.map((s,i) => {
            const dt = new Date(s.timestamp);
            const label = dt.toLocaleString("en-IN",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});
            const savings = s.grid_cost_inr === 0 ? "Free (100% RE)" : `Save ₹${(d.total_app_kw*duration*8.5 - s.grid_cost_inr).toFixed(2)}`;
            return `<tr class="${i===0?"best-slot-row":""}">
                <td>${i===0?"⭐ Best":"✅ Good"}</td>
                <td><strong>${label}</strong></td>
                <td class="mono">${s.total_kw.toFixed(2)} kW</td>
                <td class="mono">${s.app_load_kw.toFixed(2)} kW</td>
                <td class="mono ${s.surplus_kw>=0?"text-green":"text-red"}">${s.surplus_kw>=0?"+":""} ${s.surplus_kw.toFixed(2)} kW</td>
                <td>${s.fully_covered?"<span class='badge-ok'>100% RE</span>":"<span class='badge-warn'>Partial</span>"}</td>
                <td class="mono">${savings}</td>
            </tr>`;
        }).join("");

        const worstRows = d.worst_slots.map(s => {
            const dt = new Date(s.timestamp);
            const label = dt.toLocaleString("en-IN",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});
            return `<tr>
                <td>⚠️ Avoid</td>
                <td>${label}</td>
                <td class="mono">${s.total_kw.toFixed(2)} kW</td>
                <td class="mono">${s.app_load_kw.toFixed(2)} kW</td>
                <td class="mono text-red">${s.surplus_kw.toFixed(2)} kW</td>
                <td><span class="badge-warn">High Grid</span></td>
                <td class="mono text-red">Grid cost ₹${s.grid_cost_inr}</td>
            </tr>`;
        }).join("");

        // Timeline visualization for all slots
        const maxTotal = Math.max(...d.all_slots.map(s=>s.total_kw),0.1);
        const appKw    = d.total_app_kw;
        const timelineRows = d.all_slots.map(s => {
            const dt    = new Date(s.timestamp);
            const timeLabel = `${String(dt.getMonth()+1).padStart(2,"0")}/${String(dt.getDate()).padStart(2,"0")} ${String(dt.getHours()).padStart(2,"0")}:00`;
            const barW  = Math.round(s.total_kw / maxTotal * 100);
            const appW  = Math.min(Math.round(appKw / maxTotal * 100), 100);
            const c     = s.surplus_kw >= 0 ? "#10b981" : "#f59e0b";
            return `<tr>
                <td class="tl-time">${timeLabel}</td>
                <td class="tl-bar-cell">
                    <div class="tl-bar-bg">
                        <div class="tl-bar-fill" style="width:${barW}%;background:${c}"></div>
                        <div class="tl-app-line" style="left:${appW}%"></div>
                    </div>
                </td>
                <td class="mono tl-val">${s.total_kw.toFixed(1)} kW</td>
                <td class="tl-status">${s.fully_covered?"<span class='dot-green'>●</span>":"<span class='dot-yellow'>●</span>"}</td>
            </tr>`;
        }).join("");

        showPanelResult("besttime-result", `
            <div class="bt-selected-apps">
                <strong>Selected appliances:</strong> ${appList}
                <span class="feat-chip">Total: ${d.total_app_kw} kW</span>
                <span class="feat-chip">Duration: ${d.duration_hrs} hr</span>
            </div>

            <h4 class="res-sub-title">⭐ Best Times to Run (lowest grid dependency)</h4>
            <div class="compare-table-wrap">
                <table class="mini-table">
                    <thead><tr><th>Rating</th><th>Time Slot</th><th>RE Available</th><th>Appliance Load</th><th>Surplus</th><th>Coverage</th><th>Savings</th></tr></thead>
                    <tbody>${bestRows}</tbody>
                </table>
            </div>

            <h4 class="res-sub-title" style="color:#ef4444">⚠️ Times to Avoid (maximum grid usage)</h4>
            <div class="compare-table-wrap">
                <table class="mini-table">
                    <thead><tr><th>Rating</th><th>Time Slot</th><th>RE Available</th><th>Appliance Load</th><th>Deficit</th><th>Status</th><th>Grid Cost</th></tr></thead>
                    <tbody>${worstRows}</tbody>
                </table>
            </div>

            <h4 class="res-sub-title">📊 48-Hour Renewable Energy Timeline</h4>
            <p class="ds-note" style="margin-bottom:12px">Green bar = RE available. Vertical line = your appliance load. ● green = fully covered by RE.</p>
            <div class="tl-scroll-wrap">
                <table class="tl-table">
                    <thead><tr><th>Time</th><th>Renewable Energy Available</th><th>kW</th><th></th></tr></thead>
                    <tbody>${timelineRows}</tbody>
                </table>
            </div>
        `);
    } catch(e) {
        showPanelResult("besttime-result",`<div class="err-msg">❌ ${e.message}</div>`);
    } finally { setLoading(btBtn, false); }
});
