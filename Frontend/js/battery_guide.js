// RenewCast AI — Battery Storage Guide (Simplified)
// Groups 48h forecast into meaningful windows.
// Shows: key STORE and USE advice in a compact, readable way.

const BG_LOAD_PER_SLOT = 1.5; // kWh per 3h slot (~12 kWh/day home average)
const BG_BAT_MAX  = 10;       // assumed 10 kWh battery
const BG_BAT_MIN  = 1;        // always keep 10% reserved

function bgTimeFmt(tsStr) {
    // ts format: "YYYY-MM-DD HH:MM:SS"
    const d  = new Date(tsStr.replace(" ","T"));
    const hh = String(d.getHours()).padStart(2,"0");
    const h2 = String((d.getHours()+3)%24).padStart(2,"0");
    const dd = d.getDate();
    const mo = d.toLocaleString("en-IN",{month:"short"});
    return { day:`${dd} ${mo}`, time:`${hh}:00 – ${h2}:00`, hour: d.getHours() };
}

function bgPartOfDay(hour) {
    if (hour >= 5  && hour < 12) return "Morning";
    if (hour >= 12 && hour < 17) return "Afternoon";
    if (hour >= 17 && hour < 21) return "Evening";
    return "Night";
}

function bgBuildSlots(forecastData) {
    const { timestamps, solar, wind } = forecastData;
    if (!timestamps || !timestamps.length) return [];
    let soc = BG_BAT_MAX * 0.5;
    return timestamps.map((ts, i) => {
        const solarKw = solar[i]?.predicted_power_kw ?? 0;
        const windKw  = wind[i]?.predicted_power_kw  ?? 0;
        const genKwh  = (solarKw + windKw) * 3;
        const net     = genKwh - BG_LOAD_PER_SLOT;
        let action;
        if (net > 0.5) {
            const charged = Math.min(net * 0.95, BG_BAT_MAX - soc);
            soc = Math.min(soc + charged, BG_BAT_MAX);
            action = "STORE";
        } else if (net < -0.5 && soc > BG_BAT_MIN) {
            const drawn = Math.min(-net, soc - BG_BAT_MIN);
            soc = Math.max(soc - drawn, BG_BAT_MIN);
            action = "USE";
        } else if (net < -0.5) {
            action = "GRID";
        } else {
            action = "HOLD";
        }
        const fmt = bgTimeFmt(ts);
        return { ts, fmt, genKwh:+genKwh.toFixed(1), net:+net.toFixed(1), action, socPct:Math.round(soc/BG_BAT_MAX*100) };
    });
}

// Group consecutive slots with same action into windows
function bgGroupWindows(slots) {
    const windows = [];
    let cur = null;
    slots.forEach(s => {
        if (cur && cur.action === s.action && cur.day === s.fmt.day) {
            cur.toTime  = s.fmt.time.split("–")[1].trim();
            cur.genTotal += s.genKwh;
            cur.endSoc   = s.socPct;
        } else {
            if (cur) windows.push(cur);
            cur = {
                action:   s.action,
                day:      s.fmt.day,
                fromTime: s.fmt.time.split("–")[0].trim(),
                toTime:   s.fmt.time.split("–")[1].trim(),
                partOfDay:bgPartOfDay(s.fmt.hour),
                genTotal: s.genKwh,
                startSoc: s.socPct,
                endSoc:   s.socPct,
            };
        }
    });
    if (cur) windows.push(cur);
    return windows;
}

function bgSocDots(pct) {
    const filled = Math.round(pct / 20); // 5 dots max
    return Array.from({length:5},(_,i) =>
        `<span class="bg-dot ${i < filled ? "bg-dot-on" : "bg-dot-off"}"></span>`
    ).join("");
}

function renderBatteryGuide(forecastData) {
    const container = document.getElementById("battery-guide-container");
    if (!container || !forecastData) return;

    const slots   = bgBuildSlots(forecastData);
    if (!slots.length) {
        container.innerHTML = `<p style="color:#94a3b8;text-align:center;padding:20px">Run a forecast first.</p>`;
        return;
    }

    const windows = bgGroupWindows(slots);

    // Key tips — best store & best use
    const storeWins = windows.filter(w => w.action === "STORE").sort((a,b) => b.genTotal - a.genTotal);
    const useWins   = windows.filter(w => w.action === "USE" || w.action === "GRID");
    const bestStore = storeWins[0];
    const bestUse   = useWins[0];

    const cfgMap = {
        STORE:{ icon:"🟢", label:"STORE",        hint:"Charge battery",    rowCls:"bg-row-store" },
        USE:  { icon:"🔴", label:"USE",           hint:"Use stored energy", rowCls:"bg-row-use"   },
        HOLD: { icon:"🟡", label:"BALANCED",      hint:"No action needed",  rowCls:"bg-row-hold"  },
        GRID: { icon:"🔌", label:"USE GRID",      hint:"Grid power needed", rowCls:"bg-row-grid"  },
    };

    const tableRows = windows.map(w => {
        const c = cfgMap[w.action] || cfgMap.HOLD;
        return `<tr class="${c.rowCls}">
            <td class="bg-td-day">${w.day}</td>
            <td class="bg-td-time">${w.fromTime} – ${w.toTime}<br><small>${w.partOfDay}</small></td>
            <td><span class="bg-badge bg-badge-${w.action.toLowerCase()}">${c.icon} ${c.label}</span></td>
            <td class="bg-td-hint">${c.hint}</td>
            <td class="bg-td-soc">${bgSocDots(w.endSoc)} ${w.endSoc}%</td>
        </tr>`;
    }).join("");

    const tipsHtml = [
        bestStore ? `<div class="bg-tip-card bg-tip-store">
            <span class="bg-tip-ico">🟢</span>
            <div><strong>Best time to charge your battery:</strong><br>
            ${bestStore.day}, ${bestStore.fromTime} – ${bestStore.toTime} (${bestStore.partOfDay})<br>
            <small>Solar + Wind will generate ~${bestStore.genTotal.toFixed(1)} kWh — more than your home needs.</small></div>
        </div>` : "",
        bestUse ? `<div class="bg-tip-card bg-tip-use">
            <span class="bg-tip-ico">🔴</span>
            <div><strong>Best time to use stored energy:</strong><br>
            ${bestUse.day}, ${bestUse.fromTime} – ${bestUse.toTime} (${bestUse.partOfDay})<br>
            <small>Very little solar or wind expected — draw from your battery instead of the grid.</small></div>
        </div>` : "",
    ].join("");

    container.innerHTML = `
        <!-- Legend -->
        <div class="bg-legend">
            <span class="bg-leg-item"><span class="bg-dot bg-dot-on" style="background:#10b981"></span> 🟢 STORE — charge battery</span>
            <span class="bg-leg-item"><span class="bg-dot bg-dot-on" style="background:#ef4444"></span> 🔴 USE — use stored energy</span>
            <span class="bg-leg-item"><span class="bg-dot bg-dot-on" style="background:#eab308"></span> 🟡 BALANCED — rest</span>
            <span class="bg-leg-item"><span class="bg-dot bg-dot-on" style="background:#7c3aed"></span> 🔌 GRID — use grid power</span>
        </div>

        <!-- Key tips -->
        ${tipsHtml}

        <!-- Compact table -->
        <div class="compare-table-wrap" style="margin-top:16px">
            <table class="mini-table bg-table">
                <thead>
                    <tr><th>Day</th><th>Time</th><th>Action</th><th>What to do</th><th>Battery Level</th></tr>
                </thead>
                <tbody>${tableRows}</tbody>
            </table>
        </div>
        <p class="wo-footnote">📌 Based on 48-hour forecast. Assumed ~12 kWh/day home load, 10 kWh battery. Actual values depend on your system size.</p>`;
}

window.renderBatteryGuide = renderBatteryGuide;
