"""
RenewCast AI — Flask Backend
Endpoints:
  POST /api/predict          -> single-city forecast (hero card)
  POST /api/compare          -> multi-city comparison (up to 3 cities)
  POST /api/household        -> household energy + solar panels needed
  POST /api/industrial       -> industrial energy + panels/turbines needed
  POST /api/besttime         -> best hours to run heavy appliances
"""
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os, sys, math, traceback

sys.path.insert(0, os.path.dirname(__file__))
from utils.weather_api import WeatherAPI
from models.solar_model import SolarPowerPredictor
from models.wind_model  import WindPowerPredictor

app = Flask(__name__,
            static_folder=os.path.join(os.path.dirname(__file__), "..", "Frontend"),
            static_url_path="")
CORS(app, resources={r"/*": {"origins": "*"}})

weather_api     = WeatherAPI()
solar_predictor = SolarPowerPredictor()
wind_predictor  = WindPowerPredictor()

# Solar panel specs (standard residential 400W panel)
PANEL_WATTS         = 400       # W per panel
PANEL_AREA_M2       = 1.6       # m² per panel
PANEL_EFFICIENCY    = 0.20      # 20%
PEAK_HOURS_PER_DAY  = 5.5       # average peak sun hours (India)
SYSTEM_LOSSES       = 0.80      # 80% system efficiency after losses

# Wind turbine specs (small 2kW residential turbine)
TURBINE_KW          = 2.0       # kW rated power per turbine

HOUSEHOLD_APPLIANCES = {
    "lights"         : {"label":"LED Lights (10 bulbs)","watts":100 ,"icon":"💡"},
    "fan"            : {"label":"Ceiling Fan",           "watts":75  ,"icon":"🌀"},
    "fridge"         : {"label":"Refrigerator",          "watts":150 ,"icon":"🧊"},
    "tv"             : {"label":"LED TV (43\")",          "watts":80  ,"icon":"📺"},
    "ac"             : {"label":"Air Conditioner (1.5T)","watts":1500,"icon":"❄️"},
    "washing_machine": {"label":"Washing Machine",       "watts":500 ,"icon":"🫧"},
    "microwave"      : {"label":"Microwave Oven",        "watts":900 ,"icon":"🍲"},
    "geyser"         : {"label":"Water Heater/Geyser",  "watts":2000,"icon":"🚿"},
    "computer"       : {"label":"Desktop Computer",      "watts":200 ,"icon":"🖥️"},
    "pump"           : {"label":"Water Pump",            "watts":750 ,"icon":"💧"},
}

INDUSTRIAL_PROFILES = {
    "small_factory"  : {"label":"Small Factory",         "load_kw":50  },
    "medium_factory" : {"label":"Medium Factory",        "load_kw":200 },
    "large_factory"  : {"label":"Large Factory",         "load_kw":1000},
    "hospital"       : {"label":"Hospital (100-bed)",    "load_kw":300 },
    "school"         : {"label":"School / College",      "load_kw":50  },
    "shopping_mall"  : {"label":"Shopping Mall",         "load_kw":500 },
    "data_center"    : {"label":"Data Centre (small)",   "load_kw":800 },
    "water_treatment": {"label":"Water Treatment Plant", "load_kw":150 },
    "cold_storage"   : {"label":"Cold Storage Facility", "load_kw":120 },
    "textile_mill"   : {"label":"Textile Mill",          "load_kw":400 },
}

# Heavy appliances for best-time advisor
HEAVY_APPLIANCES = {
    "washing_machine": {"label":"Washing Machine",  "watts":500 },
    "ac"             : {"label":"Air Conditioner",  "watts":1500},
    "geyser"         : {"label":"Water Heater",     "watts":2000},
    "dishwasher"     : {"label":"Dishwasher",       "watts":1200},
    "microwave"      : {"label":"Microwave Oven",   "watts":900 },
    "iron"           : {"label":"Clothes Iron",     "watts":1000},
    "ev_charger"     : {"label":"EV Charger",       "watts":3300},
    "pump"           : {"label":"Water Pump",       "watts":750 },
}


def _fetch_and_predict(city=None, lat=None, lon=None):
    current, forecast_data = weather_api.get_weather(city=city, lat=lat, lon=lon)
    forecasts  = forecast_data["forecasts"]
    solar_cur  = solar_predictor.predict(current)
    wind_cur   = wind_predictor.predict(current)
    solar_fore = solar_predictor.predict_forecast(forecasts)
    wind_fore  = wind_predictor.predict_forecast(forecasts)
    total_kw   = solar_cur["predicted_power_kw"] + wind_cur["predicted_power_kw"]
    return {
        "location": {"name":current["location"],"lat":current["lat"],"lon":current["lon"]},
        "current_weather": current,
        "current_predictions": {
            "solar":solar_cur, "wind":wind_cur,
            "total_power_kw":round(total_kw,3)
        },
        "forecast": {
            "timestamps":[f["timestamp"] for f in solar_fore],
            "solar":solar_fore, "wind":wind_fore,
            "raw_slots": forecasts,
        },
        "daily_outlook": forecast_data.get("daily_outlook", []),
    }


def _panels_needed(required_daily_kwh):
    """How many 400W panels are needed to supply required_daily_kwh per day."""
    kwh_per_panel = (PANEL_WATTS/1000) * PEAK_HOURS_PER_DAY * SYSTEM_LOSSES
    panels = math.ceil(required_daily_kwh / kwh_per_panel) if kwh_per_panel > 0 else 0
    return panels, round(kwh_per_panel, 3)


def _turbines_needed(required_daily_kwh):
    """How many 2kW turbines needed (assuming 6 effective wind hours/day)."""
    eff_hours = 6
    kwh_per_turbine = TURBINE_KW * eff_hours * 0.35   # 35% capacity factor
    turbines = math.ceil(required_daily_kwh / kwh_per_turbine) if kwh_per_turbine > 0 else 0
    return turbines, round(kwh_per_turbine, 3)


# ── Static ────────────────────────────────────────────────────────────────
@app.route("/")
def serve_index():
    return send_from_directory(app.static_folder, "index.html")

@app.route("/<path:path>")
def serve_static(path):
    return send_from_directory(app.static_folder, path)

# ── POST /api/predict ─────────────────────────────────────────────────────
@app.route("/api/predict", methods=["POST"])
def predict():
    try:
        d = request.get_json()
        return jsonify(_fetch_and_predict(city=d.get("city"), lat=d.get("lat"), lon=d.get("lon")))
    except Exception as e:
        traceback.print_exc(); return jsonify({"error":str(e)}), 500

# ── POST /api/compare ─────────────────────────────────────────────────────
@app.route("/api/compare", methods=["POST"])
def compare():
    try:
        d      = request.get_json()
        cities = d.get("cities", [])   # list of city names, up to 3
        if len(cities) < 2:
            return jsonify({"error":"At least 2 cities required"}), 400
        cities = cities[:3]

        results = [_fetch_and_predict(city=c) for c in cities]

        city_data = []
        for r in results:
            p = r["current_predictions"]
            w = r["current_weather"]
            city_data.append({
                "name"         : r["location"]["name"],
                "lat"          : r["location"]["lat"],
                "lon"          : r["location"]["lon"],
                "solar_kw"     : p["solar"]["predicted_power_kw"],
                "wind_kw"      : p["wind"]["predicted_power_kw"],
                "total_kw"     : p["total_power_kw"],
                "solar_eff_pct": p["solar"]["efficiency_pct"],
                "wind_regime"  : p["wind"].get("wind_regime","–"),
                "temperature"  : w["temperature"],
                "wind_speed"   : w["wind_speed"],
                "cloud_cover"  : w["cloud_cover"],
                "humidity"     : w["humidity"],
                "irradiance"   : w["solar_irradiance"],
                "pressure"     : w["pressure"],
                "weather_desc" : w["weather_desc"],
            })

        return jsonify({"cities": city_data})
    except Exception as e:
        traceback.print_exc(); return jsonify({"error":str(e)}), 500

# ── POST /api/household ───────────────────────────────────────────────────
@app.route("/api/household", methods=["POST"])
def household():
    try:
        d          = request.get_json()
        city       = d.get("city")
        appliances = d.get("appliances", {})
        num_houses = int(d.get("num_houses", 1))
        daily_hours= float(d.get("daily_hours", 8))   # hours per day appliances run

        forecast  = _fetch_and_predict(city=city)
        total_kw  = forecast["current_predictions"]["total_power_kw"]

        load_w    = 0
        breakdown = []
        for key, qty in appliances.items():
            if key in HOUSEHOLD_APPLIANCES and qty > 0:
                w = HOUSEHOLD_APPLIANCES[key]["watts"] * qty
                load_w += w
                breakdown.append({
                    "appliance"  : HOUSEHOLD_APPLIANCES[key]["label"],
                    "quantity"   : qty,
                    "power_w"    : HOUSEHOLD_APPLIANCES[key]["watts"],
                    "total_w"    : w,
                    "daily_kwh"  : round(w/1000 * daily_hours, 3),
                })

        load_kw         = load_w / 1000
        total_load_kw   = load_kw * num_houses
        daily_kwh_house = load_kw * daily_hours
        daily_kwh_total = daily_kwh_house * num_houses

        houses_supported= round(total_kw / load_kw, 1) if load_kw > 0 else 0
        coverage_pct    = min(total_kw / total_load_kw * 100, 100) if total_load_kw > 0 else 0
        surplus_kw      = max(total_kw - total_load_kw, 0)
        deficit_kw      = max(total_load_kw - total_kw, 0)

        # Solar panels required for ALL houses (daily energy need)
        panels_needed, kwh_per_panel = _panels_needed(daily_kwh_total)
        # Per-house breakdown
        panels_per_house, _          = _panels_needed(daily_kwh_house)
        # Turbines (supplementary)
        turbines_needed, kwh_per_turb = _turbines_needed(daily_kwh_total)

        # Cost estimates (India)
        panel_cost_inr  = panels_needed * 25000   # ~₹25,000 per 400W panel installed
        monthly_saving  = round(total_kw * daily_hours * 30 * 8.5, 0)  # ₹8.5/kWh
        payback_years   = round(panel_cost_inr / (monthly_saving * 12), 1) if monthly_saving > 0 else 0

        return jsonify({
            "forecast"          : forecast,
            "input_appliances"  : breakdown,
            "load_per_house_kw" : round(load_kw, 3),
            "num_houses"        : num_houses,
            "daily_hours"       : daily_hours,
            "total_load_kw"     : round(total_load_kw, 3),
            "daily_kwh_total"   : round(daily_kwh_total, 2),
            "total_generated_kw": round(total_kw, 3),
            "houses_supported"  : houses_supported,
            "coverage_pct"      : round(coverage_pct, 1),
            "surplus_kw"        : round(surplus_kw, 3),
            "deficit_kw"        : round(deficit_kw, 3),
            "status"            : "sufficient" if total_kw >= total_load_kw else "insufficient",
            "solar_sizing": {
                "panels_needed"    : panels_needed,
                "panels_per_house" : panels_per_house,
                "panel_watt"       : PANEL_WATTS,
                "panel_area_m2"    : PANEL_AREA_M2,
                "kwh_per_panel_day": kwh_per_panel,
                "total_area_m2"    : round(panels_needed * PANEL_AREA_M2, 1),
                "system_kw"        : round(panels_needed * PANEL_WATTS / 1000, 2),
                "est_cost_inr"     : panel_cost_inr,
                "monthly_saving_inr": int(monthly_saving),
                "payback_years"    : payback_years,
            },
            "wind_sizing": {
                "turbines_needed"  : turbines_needed,
                "turbine_kw"       : TURBINE_KW,
                "kwh_per_turbine_day": kwh_per_turb,
            },
        })
    except Exception as e:
        traceback.print_exc(); return jsonify({"error":str(e)}), 500

# ── POST /api/industrial ──────────────────────────────────────────────────
@app.route("/api/industrial", methods=["POST"])
def industrial():
    try:
        d           = request.get_json()
        city        = d.get("city")
        sector      = d.get("sector", "small_factory")
        num_units   = int(d.get("num_units", 1))
        shift_hours = int(d.get("shift_hours", 8))

        if sector not in INDUSTRIAL_PROFILES:
            return jsonify({"error":f"Unknown sector: {sector}"}), 400

        forecast     = _fetch_and_predict(city=city)
        total_kw     = forecast["current_predictions"]["total_power_kw"]
        profile      = INDUSTRIAL_PROFILES[sector]
        unit_load_kw = profile["load_kw"]
        total_load   = unit_load_kw * num_units
        daily_kwh    = total_load * shift_hours

        units_powered  = round(total_kw / unit_load_kw, 2) if unit_load_kw > 0 else 0
        coverage_pct   = min(total_kw / total_load * 100, 100) if total_load > 0 else 0
        surplus_kw     = max(total_kw - total_load, 0)
        deficit_kw     = max(total_load - total_kw, 0)
        co2_saved_kg   = round(total_kw * 0.82, 2)
        daily_saving   = round(total_kw * shift_hours * 8.5, 2)

        # Solar panels needed for the facility
        panels_needed, kwh_per_panel = _panels_needed(daily_kwh)
        panel_area_m2  = round(panels_needed * PANEL_AREA_M2, 1)
        system_kw      = round(panels_needed * PANEL_WATTS / 1000, 2)
        # Large industrial panels cost ~₹40,000 each installed
        est_cost_inr   = panels_needed * 40000
        annual_saving  = daily_saving * 365
        payback_years  = round(est_cost_inr / annual_saving, 1) if annual_saving > 0 else 0

        # Wind turbines (industrial — 2 MW class, ~2000 kW)
        LARGE_TURBINE_KW = 2000
        turb_eff_hours   = 8
        kwh_per_large    = LARGE_TURBINE_KW * turb_eff_hours * 0.35
        large_turbines   = math.ceil(daily_kwh / kwh_per_large) if kwh_per_large > 0 else 0

        # Per sub-unit breakdown table
        unit_breakdown = []
        for i in range(1, min(num_units, 10) + 1):
            cum_load  = unit_load_kw * i
            covered   = min(total_kw, cum_load)
            unit_breakdown.append({
                "unit_no"     : i,
                "load_kw"     : cum_load,
                "covered_kw"  : round(covered, 2),
                "coverage_pct": round(covered / cum_load * 100, 1),
                "deficit_kw"  : round(max(cum_load - total_kw, 0), 2),
            })

        return jsonify({
            "forecast"          : forecast,
            "sector_label"      : profile["label"],
            "unit_load_kw"      : unit_load_kw,
            "num_units"         : num_units,
            "total_load_kw"     : round(total_load, 3),
            "total_generated_kw": round(total_kw, 3),
            "units_powered"     : units_powered,
            "coverage_pct"      : round(coverage_pct, 1),
            "surplus_kw"        : round(surplus_kw, 3),
            "deficit_kw"        : round(deficit_kw, 3),
            "daily_energy_kwh"  : round(daily_kwh, 2),
            "co2_saved_kg_hr"   : co2_saved_kg,
            "daily_saving_inr"  : daily_saving,
            "shift_hours"       : shift_hours,
            "status"            : "sufficient" if total_kw >= total_load else "insufficient",
            "unit_breakdown"    : unit_breakdown,
            "solar_sizing": {
                "panels_needed"   : panels_needed,
                "panel_watt"      : PANEL_WATTS,
                "kwh_per_panel"   : kwh_per_panel,
                "total_area_m2"   : panel_area_m2,
                "system_kw"       : system_kw,
                "est_cost_inr"    : est_cost_inr,
                "daily_saving_inr": daily_saving,
                "payback_years"   : payback_years,
            },
            "wind_sizing": {
                "turbines_needed" : large_turbines,
                "turbine_kw"      : LARGE_TURBINE_KW,
                "kwh_per_turbine" : round(kwh_per_large, 1),
            },
        })
    except Exception as e:
        traceback.print_exc(); return jsonify({"error":str(e)}), 500

# ── POST /api/besttime ────────────────────────────────────────────────────
@app.route("/api/besttime", methods=["POST"])
def best_time():
    try:
        d              = request.get_json()
        city           = d.get("city")
        appliance_keys = d.get("appliances", [])   # list of appliance keys
        duration_hrs   = float(d.get("duration_hrs", 1))

        forecast = _fetch_and_predict(city=city)
        fore     = forecast["forecast"]

        # Build per-slot total power list
        slots = []
        for i, ts in enumerate(fore["timestamps"]):
            solar_kw = fore["solar"][i]["predicted_power_kw"] if i < len(fore["solar"]) else 0
            wind_kw  = fore["wind"][i]["predicted_power_kw"]  if i < len(fore["wind"])  else 0
            total_kw = solar_kw + wind_kw
            # Calculate appliance load
            app_w    = sum(HEAVY_APPLIANCES[k]["watts"] for k in appliance_keys if k in HEAVY_APPLIANCES)
            app_kw   = app_w / 1000
            surplus  = round(total_kw - app_kw, 3)
            cost_inr = round(max(app_kw - total_kw, 0) * duration_hrs * 8.5, 2)
            slots.append({
                "timestamp" : ts,
                "solar_kw"  : round(solar_kw, 2),
                "wind_kw"   : round(wind_kw, 2),
                "total_kw"  : round(total_kw, 2),
                "app_load_kw": round(app_kw, 2),
                "surplus_kw": surplus,
                "fully_covered": surplus >= 0,
                "grid_cost_inr": cost_inr,
            })

        # Best slots = highest surplus (most renewable available)
        sorted_slots  = sorted(slots, key=lambda x: x["surplus_kw"], reverse=True)
        best_slots    = sorted_slots[:5]
        # Worst slots
        worst_slots   = sorted_slots[-3:]

        # Build selected appliance info
        selected_apps = [
            {"key":k, "label":HEAVY_APPLIANCES[k]["label"], "watts":HEAVY_APPLIANCES[k]["watts"]}
            for k in appliance_keys if k in HEAVY_APPLIANCES
        ]

        return jsonify({
            "city"           : forecast["location"]["name"],
            "all_slots"      : slots,
            "best_slots"     : best_slots,
            "worst_slots"    : worst_slots,
            "selected_apps"  : selected_apps,
            "total_app_kw"   : round(sum(a["watts"] for a in selected_apps)/1000, 2),
            "duration_hrs"   : duration_hrs,
            "heavy_catalog"  : HEAVY_APPLIANCES,
        })
    except Exception as e:
        traceback.print_exc(); return jsonify({"error":str(e)}), 500


if __name__ == "__main__":
    print("\n" + "="*55)
    print("  RenewCast AI — Advanced Energy Forecasting")
    print("  http://127.0.0.1:5000")
    print("="*55 + "\n")
    app.run(debug=True, port=5000, host="127.0.0.1")
