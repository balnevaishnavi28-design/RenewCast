// RenewCast AI — Main forecast
const API_BASE_URL = "http://127.0.0.1:5000/api";
window.lastForecastResult = null;

// ── Hero card tab switching ───────────────────────────────────────────────
document.querySelectorAll(".forecast-card .itab").forEach(btn => {
    btn.addEventListener("click", () => {
        const tab = btn.dataset.tab;
        document.querySelectorAll(".forecast-card .itab").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        document.querySelectorAll(".forecast-card .tab-content").forEach(c => c.classList.remove("active"));
        document.getElementById(`${tab}-tab`).classList.add("active");
        if (tab === "city") {
            document.getElementById("lat-input").value = "";
            document.getElementById("lon-input").value = "";
        } else {
            document.getElementById("city-input").value = "";
        }
    });
});

// ── Helpers ───────────────────────────────────────────────────────────────
function showLoading()  { document.getElementById("loading").style.display = "flex"; }
function hideLoading()  { document.getElementById("loading").style.display = "none"; }
function showError(msg) {
    document.getElementById("error").style.display = "flex";
    document.getElementById("error-message").textContent = msg;
}
function closeError() { document.getElementById("error").style.display = "none"; }

function weatherIcon(desc) {
    desc = (desc || "").toLowerCase();
    if (desc.includes("thunder")) return "⛈️";
    if (desc.includes("drizzle")) return "🌦️";
    if (desc.includes("rain"))    return "🌧️";
    if (desc.includes("snow"))    return "❄️";
    if (desc.includes("mist") || desc.includes("fog")) return "🌫️";
    if (desc.includes("overcast")) return "☁️";
    if (desc.includes("cloud"))   return "⛅";
    return "☀️";
}

// ════════════════════════════════════════════════════════════════════════════
// SOLAR POWER — meaningful description based on irradiance + efficiency
// ════════════════════════════════════════════════════════════════════════════
function solarDescription(solarKw, irradiance, cloud, hour) {
    const maxSolar    = 35;       // kW max from 100 panels
    const efficiencyPct = Math.round(solarKw / maxSolar * 100);
    const isDaytime   = hour >= 6 && hour <= 18;

    // Determine generation level
    let level, levelColor, levelIcon;
    if (!isDaytime) {
        level = "No Generation";  levelColor = "night";   levelIcon = "🌙";
    } else if (efficiencyPct >= 75) {
        level = "Peak Generation"; levelColor = "high";   levelIcon = "🔥";
    } else if (efficiencyPct >= 40) {
        level = "Good Generation"; levelColor = "good";   levelIcon = "✅";
    } else if (efficiencyPct >= 10) {
        level = "Partial Generation"; levelColor = "warn"; levelIcon = "⚠️";
    } else {
        level = "Low Generation"; levelColor = "low";    levelIcon = "📉";
    }

    // Reason based on conditions
    let reason = "";
    if (!isDaytime) {
        reason = "Sun has set — solar panels are inactive.";
    } else if (cloud > 70) {
        reason = `Heavy cloud cover (${cloud}%) is blocking most sunlight.`;
    } else if (cloud > 40) {
        reason = `Moderate clouds (${cloud}%) are reducing solar output.`;
    } else if (irradiance >= 600) {
        reason = `Strong sunlight — ${irradiance} W/m² irradiance reaching panels.`;
    } else if (irradiance >= 300) {
        reason = `Moderate sunlight — ${irradiance} W/m² irradiance available.`;
    } else {
        reason = `Low irradiance (${irradiance} W/m²) — limited solar potential.`;
    }

    const badge = `<span class="pc-badge pc-badge-${levelColor}">${levelIcon} ${level}</span>`;
    const desc  = `<span class="pc-desc-text">${reason} Efficiency: ${efficiencyPct}%</span>`;
    return { badge, desc, efficiencyPct, levelColor };
}

// ════════════════════════════════════════════════════════════════════════════
// WIND POWER — meaningful description based on speed + turbine regime
// ════════════════════════════════════════════════════════════════════════════
function windDescription(windKw, windSpeed) {
    // Turbine regime thresholds
    let regime, regimeColor, regimeIcon, reason;

    if (windSpeed < 3) {
        regime = "Below Cut-In Speed"; regimeColor = "low"; regimeIcon = "🚫";
        reason = `Wind speed ${windSpeed} m/s is below 3 m/s cut-in — turbines are stationary.`;
    } else if (windSpeed < 6) {
        regime = "Low Wind"; regimeColor = "warn"; regimeIcon = "🌀";
        reason = `Light wind at ${windSpeed} m/s — turbines spinning at partial capacity.`;
    } else if (windSpeed < 12) {
        regime = "Optimal Wind"; regimeColor = "good"; regimeIcon = "✅";
        reason = `Wind speed ${windSpeed} m/s is in the ideal range (6–12 m/s) for maximum power.`;
    } else if (windSpeed <= 25) {
        regime = "Rated Power"; regimeColor = "high"; regimeIcon = "⚡";
        reason = `Strong wind at ${windSpeed} m/s — turbines generating at rated capacity.`;
    } else {
        regime = "Cut-Out (Safety Stop)"; regimeColor = "danger"; regimeIcon = "🛑";
        reason = `Wind speed ${windSpeed} m/s exceeds 25 m/s cut-out — turbines stopped for safety.`;
    }

    const badge = `<span class="pc-badge pc-badge-${regimeColor}">${regimeIcon} ${regime}</span>`;
    const desc  = `<span class="pc-desc-text">${reason}</span>`;
    return { badge, desc, regimeColor };
}

// ════════════════════════════════════════════════════════════════════════════
// WEATHER CARDS — colour + status badge + icon animation
// ════════════════════════════════════════════════════════════════════════════
function applyWeatherCardStyling(cur) {
    const temp       = cur.temperature;
    const humidity   = cur.humidity;
    const windSpeed  = cur.wind_speed;
    const cloud      = cur.cloud_cover;
    const irradiance = cur.solar_irradiance;
    const pressure   = cur.pressure;

    // ── Temperature card ─────────────────────────────────────────────────
    setWeatherCard("card-temp", "status-temp", (() => {
        if (temp >= 42)   return { cls:"wc-danger",  badge:"🔴 Extreme Heat",   text:`${temp}°C is dangerously hot. High risk of heat stroke.` };
        if (temp >= 36)   return { cls:"wc-warn",    badge:"🟠 Very Hot",       text:`${temp}°C — very hot. Solar panel efficiency may drop.` };
        if (temp >= 28)   return { cls:"wc-ok",      badge:"🟡 Warm",           text:`${temp}°C — warm conditions. Good solar generation expected.` };
        if (temp >= 18)   return { cls:"wc-good",    badge:"🟢 Comfortable",    text:`${temp}°C — ideal weather for both solar and wind energy.` };
        if (temp >= 10)   return { cls:"wc-ok",      badge:"🔵 Cool",           text:`${temp}°C — cool. Wind turbines perform better in cooler air.` };
        return               { cls:"wc-cold",    badge:"🔵 Cold",           text:`${temp}°C — cold conditions. Possible reduced equipment performance.` };
    })());

    // ── Humidity card ─────────────────────────────────────────────────────
    setWeatherCard("card-humidity", "status-humidity", (() => {
        if (humidity >= 85) return { cls:"wc-warn",  badge:"🟠 Very Humid",     text:`${humidity}% — high moisture. May reduce solar panel efficiency.` };
        if (humidity >= 60) return { cls:"wc-ok",    badge:"🟡 Moderate",       text:`${humidity}% — moderate humidity. Normal generation expected.` };
        if (humidity >= 30) return { cls:"wc-good",  badge:"🟢 Optimal",        text:`${humidity}% — optimal humidity for renewable energy systems.` };
        return                   { cls:"wc-warn",  badge:"🟠 Very Dry",       text:`${humidity}% — very dry. Dust may accumulate on solar panels.` };
    })());

    // ── Wind Speed card ───────────────────────────────────────────────────
    setWeatherCard("card-wind-speed", "status-wind-speed", (() => {
        if (windSpeed > 25)  return { cls:"wc-danger", badge:"🔴 Danger Zone",   text:`${windSpeed} m/s — above cut-out. Turbines shut down for safety.` };
        if (windSpeed >= 12) return { cls:"wc-high",   badge:"⚡ Rated Power",   text:`${windSpeed} m/s — turbines at full rated output.` };
        if (windSpeed >= 6)  return { cls:"wc-good",   badge:"🟢 Optimal Range", text:`${windSpeed} m/s — ideal wind speed for maximum power generation.` };
        if (windSpeed >= 3)  return { cls:"wc-warn",   badge:"🟡 Partial Power", text:`${windSpeed} m/s — some generation. Below optimal range.` };
        return                    { cls:"wc-low",    badge:"🔵 Below Cut-In",  text:`${windSpeed} m/s — too slow. Turbines not yet spinning.` };
    })());

    // ── Cloud Cover card ──────────────────────────────────────────────────
    setWeatherCard("card-cloud", "status-cloud", (() => {
        if (cloud >= 80) return { cls:"wc-warn",   badge:"🟠 Heavy Overcast",  text:`${cloud}% cloud cover — most sunlight blocked. Low solar output.` };
        if (cloud >= 50) return { cls:"wc-ok",     badge:"🟡 Partly Cloudy",   text:`${cloud}% clouds — solar output reduced but wind may be good.` };
        if (cloud >= 20) return { cls:"wc-good",   badge:"🟢 Mostly Clear",    text:`${cloud}% — mostly clear skies. Good conditions for solar.` };
        return                { cls:"wc-solar",  badge:"☀️ Clear Sky",        text:`${cloud}% — clear sky. Maximum solar potential available.` };
    })());

    // ── Solar Irradiance card ─────────────────────────────────────────────
    setWeatherCard("card-irradiance", "status-irradiance", (() => {
        if (irradiance >= 800) return { cls:"wc-high",   badge:"🔥 Very High",      text:`${irradiance} W/m² — excellent solar energy reaching panels.` };
        if (irradiance >= 500) return { cls:"wc-good",   badge:"🟢 High",           text:`${irradiance} W/m² — strong irradiance, good solar generation.` };
        if (irradiance >= 200) return { cls:"wc-ok",     badge:"🟡 Moderate",       text:`${irradiance} W/m² — moderate sunlight available.` };
        if (irradiance > 0)    return { cls:"wc-warn",   badge:"🟠 Low",            text:`${irradiance} W/m² — low irradiance, limited solar output.` };
        return                      { cls:"wc-night",  badge:"🌙 None",           text:`No solar irradiance — nighttime or fully overcast.` };
    })());

    // ── Pressure card ─────────────────────────────────────────────────────
    setWeatherCard("card-pressure", "status-pressure", (() => {
        if (pressure >= 1020) return { cls:"wc-good",  badge:"🟢 High Pressure",   text:`${pressure} hPa — high pressure system. Clear skies likely.` };
        if (pressure >= 1000) return { cls:"wc-ok",    badge:"🟡 Normal",          text:`${pressure} hPa — normal atmospheric pressure.` };
        if (pressure >= 980)  return { cls:"wc-warn",  badge:"🟠 Low Pressure",    text:`${pressure} hPa — low pressure. Clouds and wind likely.` };
        return                     { cls:"wc-danger", badge:"🔴 Storm Risk",      text:`${pressure} hPa — very low pressure. Storm conditions possible.` };
    })());
}

function setWeatherCard(cardId, statusId, config) {
    const card   = document.getElementById(cardId);
    const status = document.getElementById(statusId);
    if (!card || !status) return;

    // Remove previous state classes
    card.classList.remove("wc-danger","wc-warn","wc-ok","wc-good","wc-high","wc-low","wc-cold","wc-night","wc-solar");
    card.classList.add(config.cls);

    // Add pulsing animation for danger/extreme states
    if (config.cls === "wc-danger") {
        card.classList.add("wc-pulse");
    } else {
        card.classList.remove("wc-pulse");
    }

    status.innerHTML = `
        <span class="wc-badge-chip">${config.badge}</span>
        <span class="wc-tip">${config.text}</span>`;
}

// ════════════════════════════════════════════════════════════════════════════
// RENDER MAIN RESULTS
// ════════════════════════════════════════════════════════════════════════════
function renderResults(data) {
    window.lastForecastResult = data;

    // Auto-fill city inputs in feature tabs
    const cityName = data.location.name;
    ["hh-city","ind-city","bt-city"].forEach(id => {
        const el = document.getElementById(id);
        if (el && !el.value) el.value = cityName;
    });
    document.querySelectorAll(".compare-city-input").forEach((inp, i) => {
        if (i === 0 && !inp.value) inp.value = cityName;
    });

    document.getElementById("results").style.display = "block";
    document.getElementById("results").scrollIntoView({ behavior: "smooth" });

    const loc  = data.location;
    const cur  = data.current_weather;
    const pred = data.current_predictions;
    const fore = data.forecast;

    // ── Location ──────────────────────────────────────────────────────────
    document.getElementById("location-name").textContent   = loc.name;
    document.getElementById("location-coords").textContent = `${loc.lat}°N, ${loc.lon}°E`;
    document.getElementById("weather-icon").textContent    = weatherIcon(cur.weather_desc);

    // ── Power values ──────────────────────────────────────────────────────
    const solarKw = pred.solar.predicted_power_kw;
    const windKw  = pred.wind.predicted_power_kw;
    const totalKw = pred.total_power_kw;

    document.getElementById("solar-current").textContent = solarKw.toFixed(2);
    document.getElementById("wind-current").textContent  = windKw.toFixed(2);
    document.getElementById("total-current").textContent = totalKw.toFixed(2);

    // ── Solar rich description ─────────────────────────────────────────────
    const sol = solarDescription(solarKw, cur.solar_irradiance, cur.cloud_cover, cur.hour);
    document.getElementById("solar-trend-icon").textContent = sol.efficiencyPct >= 40 ? "↑" : "↓";
    document.getElementById("solar-trend-text").textContent = `${sol.efficiencyPct}% panel efficiency`;
    document.getElementById("solar-desc").innerHTML         = sol.desc;
    document.getElementById("solar-badge-row").innerHTML    = sol.badge;
    // Colour the solar trend row
    const solarTrend = document.getElementById("solar-trend");
    solarTrend.className = "pc-trend pc-trend-" + sol.levelColor;

    // ── Wind rich description ──────────────────────────────────────────────
    const win = windDescription(windKw, cur.wind_speed);
    document.getElementById("wind-trend-icon").textContent = windKw > 0 ? "↑" : "↓";
    document.getElementById("wind-trend-text").textContent = `${cur.wind_speed} m/s wind speed`;
    document.getElementById("wind-desc").innerHTML         = win.desc;
    document.getElementById("wind-badge-row").innerHTML    = win.badge;
    const windTrend = document.getElementById("wind-trend");
    windTrend.className = "pc-trend pc-trend-" + win.regimeColor;

    // ── Capacity bar ──────────────────────────────────────────────────────
    const maxKw = 2535;
    document.getElementById("efficiency-fill").style.width =
        Math.min(totalKw / maxKw * 100, 100) + "%";
    document.getElementById("efficiency-value").textContent =
        (totalKw / maxKw * 100).toFixed(1) + "%";

    // ── Raw weather values ────────────────────────────────────────────────
    document.getElementById("temp-value").textContent       = `${cur.temperature}°C`;
    document.getElementById("humidity-value").textContent   = `${cur.humidity}%`;
    document.getElementById("wind-speed-value").textContent = `${cur.wind_speed} m/s`;
    document.getElementById("cloud-value").textContent      = `${cur.cloud_cover}%`;
    document.getElementById("irradiance-value").textContent = `${cur.solar_irradiance} W/m²`;
    document.getElementById("pressure-value").textContent   = `${cur.pressure} hPa`;

    // ── Apply colour styling to weather cards ─────────────────────────────
    applyWeatherCardStyling(cur);

    // ── Charts + Map ──────────────────────────────────────────────────────
    if (typeof renderForecastChart === "function") renderForecastChart(fore);
    if (typeof renderMap          === "function") renderMap(loc.lat, loc.lon, loc.name);

    // ── Update feature tab banner ─────────────────────────────────────────
    const banner = document.getElementById("forecast-reuse-banner");
    if (banner) {
        banner.style.display = "flex";
        banner.innerHTML = `✅ Active forecast: <strong>${loc.name}</strong> —
            Solar <strong>${solarKw.toFixed(2)} kW</strong> +
            Wind <strong>${windKw.toFixed(2)} kW</strong> =
            <strong>${totalKw.toFixed(2)} kW</strong>
            &nbsp;·&nbsp; <em>All feature tabs use this same value</em>`;
    }
}

// ── Hero predict button ───────────────────────────────────────────────────
document.getElementById("predict-btn").addEventListener("click", async () => {
    const city = document.getElementById("city-input").value.trim();
    const lat  = parseFloat(document.getElementById("lat-input").value);
    const lon  = parseFloat(document.getElementById("lon-input").value);

    if (!city && (isNaN(lat) || isNaN(lon))) {
        showError("Please enter a city name or valid coordinates.");
        return;
    }

    showLoading();
    closeError();
    document.getElementById("results").style.display = "none";

    try {
        const body = city ? { city } : { lat, lon };
        const res  = await fetch(`${API_BASE_URL}/predict`, {
            method : "POST",
            headers: { "Content-Type": "application/json" },
            body   : JSON.stringify(body),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        renderResults(data);
    } catch (err) {
        showError(err.message);
    } finally {
        hideLoading();
    }
});

document.getElementById("city-input").addEventListener("keydown", e => {
    if (e.key === "Enter") document.getElementById("predict-btn").click();
});
