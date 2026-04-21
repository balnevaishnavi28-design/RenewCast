// RenewCast AI — 7-Day Weather Outlook
// Shows simple condition cards: Today, Tomorrow, Mon, Tue ...
// Only shows condition (Hot, Rainy, Cloudy etc) — clean and simple.
// Date logic uses LOCAL time to avoid off-by-one errors.

// ── Map weather_main → simple label + emoji ─────────────────────────────
function woGetProfile(weatherMain, cloudAvg, tempMax) {
    const m = (weatherMain || "").toLowerCase();
    if (m === "thunderstorm") return { emoji:"⛈️", label:"Thunderstorm",   color:"#1e3a5f", bg:"#dbeafe" };
    if (m === "rain")         return { emoji:"🌧️", label:"Rainy",          color:"#1d4ed8", bg:"#eff6ff" };
    if (m === "drizzle")      return { emoji:"🌦️", label:"Light Rain",     color:"#2563eb", bg:"#eff6ff" };
    if (m === "snow")         return { emoji:"❄️", label:"Snow / Cold",    color:"#0369a1", bg:"#e0f2fe" };
    if (["mist","fog","haze","smoke","dust","sand","squall","tornado"].includes(m))
                              return { emoji:"🌫️", label:"Foggy / Hazy",   color:"#475569", bg:"#f1f5f9" };
    // Clear skies — check temp for hot
    if (cloudAvg < 40 && tempMax >= 38) return { emoji:"🔆", label:"Hot & Sunny",   color:"#b45309", bg:"#fef9c3" };
    if (cloudAvg < 40)                  return { emoji:"☀️", label:"Clear & Sunny", color:"#ca8a04", bg:"#fefce8" };
    if (cloudAvg < 70)                  return { emoji:"⛅", label:"Partly Cloudy", color:"#4b5563", bg:"#f9fafb" };
    return                              { emoji:"☁️", label:"Cloudy",          color:"#374151", bg:"#f3f4f6" };
}

// ── Correct day label using LOCAL date ──────────────────────────────────
// dateStr is "YYYY-MM-DD" (UTC date from API)
function woDayLabel(dateStr) {
    // Compare against today's LOCAL date string
    const now       = new Date();
    const todayStr  = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;

    // Tomorrow local date
    const tom       = new Date(now); tom.setDate(tom.getDate()+1);
    const tomStr    = `${tom.getFullYear()}-${String(tom.getMonth()+1).padStart(2,"0")}-${String(tom.getDate()).padStart(2,"0")}`;

    if (dateStr === todayStr) return { short:"Today",    full:"Today" };
    if (dateStr === tomStr)   return { short:"Tomorrow", full:"Tomorrow" };

    // Parse date parts directly from string — no timezone conversion
    const [yr, mo, dy] = dateStr.split("-").map(Number);
    const d = new Date(yr, mo-1, dy); // local date, no UTC shift
    const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    return { short: DAYS[d.getDay()], full: DAYS[d.getDay()] };
}

function woFormatDate(dateStr) {
    const [yr, mo, dy] = dateStr.split("-").map(Number);
    const d = new Date(yr, mo-1, dy);
    return d.toLocaleDateString("en-IN", { day:"numeric", month:"short" });
}

// ── Render ──────────────────────────────────────────────────────────────
function renderWeeklyOutlook(dailyOutlook) {
    const container = document.getElementById("weekly-outlook-container");
    if (!container) return;

    if (!dailyOutlook || dailyOutlook.length === 0) {
        container.innerHTML = `<p style="color:#94a3b8;text-align:center;padding:20px">
            No weekly forecast data available. The OpenWeatherMap free tier provides up to 5 days of data.</p>`;
        return;
    }

    const days = dailyOutlook.slice(0, 7);

    const cards = days.map((day, idx) => {
        const prof   = woGetProfile(day.weather_main, day.cloud_avg, day.temp_max);
        const lbl    = woDayLabel(day.date);
        const isToday = lbl.short === "Today";

        return `<div class="wo-card ${isToday ? "wo-card-today" : ""}">
            <div class="wo-day-name ${isToday ? "wo-today-lbl" : ""}">${lbl.short}</div>
            <div class="wo-date-str">${woFormatDate(day.date)}</div>
            <div class="wo-emoji-big">${prof.emoji}</div>
            <div class="wo-cond-label" style="background:${prof.bg};color:${prof.color}">${prof.label}</div>
            <div class="wo-temps">
                <span class="wo-tmax">↑${day.temp_max}°C</span>
                <span class="wo-tmin">↓${day.temp_min}°C</span>
            </div>
        </div>`;
    }).join("");

    container.innerHTML = `
        <div class="wo-cards-grid">${cards}</div>
        <p class="wo-footnote">📡 Based on OpenWeatherMap 5-day forecast. Data covers up to 5 days ahead and updates with each forecast run.</p>`;
}

window.renderWeeklyOutlook = renderWeeklyOutlook;
