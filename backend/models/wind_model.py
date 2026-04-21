"""Wind power prediction model — wraps the trained Random Forest."""

import numpy as np, joblib, os, math

MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "trained_models")

WIND_FEATURES = [
    "Wind Speed (m/s)", "wind_speed_squared", "wind_speed_cubed",
    "Temperature (°C)", "Humidity (%)", "Pressure (hPa)",
    "air_density", "wind_power_density",
    "hour", "month", "hour_sin", "hour_cos",
    "month_sin", "month_cos", "wind_dir_sin", "wind_dir_cos",
]

TURBINE_BLADE_RADIUS = 40
TURBINE_CP           = 0.35
NUM_TURBINES         = 10
CUT_IN_SPEED         = 3.0
RATED_SPEED          = 12.0
CUT_OUT_SPEED        = 25.0


class WindPowerPredictor:
    def __init__(self):
        model_path  = os.path.join(MODELS_DIR, "wind_model.pkl")
        scaler_path = os.path.join(MODELS_DIR, "wind_scaler.pkl")
        if os.path.exists(model_path):
            self._model  = joblib.load(model_path)
            self._scaler = joblib.load(scaler_path)
            self._ready  = True
        else:
            self._ready  = False

    def _build_features(self, w: dict) -> list:
        speed = w.get("wind_speed", 0)
        temp  = w.get("temperature", 20)
        hum   = w.get("humidity", 50)
        pres  = w.get("pressure", 1013.25)
        hour  = w.get("hour", 12)
        month = w.get("month", 6)
        wdir  = w.get("wind_direction", 0)

        ws2  = speed ** 2
        ws3  = speed ** 3
        rho  = (pres * 100) / (287.05 * (temp + 273.15))
        wpd  = 0.5 * rho * ws3

        return [
            speed, ws2, ws3,
            temp, hum, pres,
            rho, wpd,
            hour, month,
            math.sin(2 * math.pi * hour / 24),
            math.cos(2 * math.pi * hour / 24),
            math.sin(2 * math.pi * month / 12),
            math.cos(2 * math.pi * month / 12),
            math.sin(math.radians(wdir)),
            math.cos(math.radians(wdir)),
        ]

    def _physics_fallback(self, w: dict) -> float:
        speed = w.get("wind_speed", 0)
        temp  = w.get("temperature", 20)
        pres  = w.get("pressure", 1013.25)
        if speed < CUT_IN_SPEED or speed > CUT_OUT_SPEED:
            return 0.0
        rho  = (pres * 100) / (287.05 * (temp + 273.15))
        area = math.pi * TURBINE_BLADE_RADIUS ** 2
        eff_speed = min(speed, RATED_SPEED)
        power = 0.5 * rho * area * eff_speed**3 * TURBINE_CP / 1000
        return round(max(power * NUM_TURBINES, 0), 3)

    def predict(self, weather: dict) -> dict:
        if self._ready:
            feats   = np.array(self._build_features(weather)).reshape(1, -1)
            feats_s = self._scaler.transform(feats)
            power   = float(max(self._model.predict(feats_s)[0], 0))
        else:
            power = self._physics_fallback(weather)

        speed = weather.get("wind_speed", 0)
        return {
            "predicted_power_kw": round(power, 3),
            "efficiency_pct"    : round(min(power / 2500 * 100, 100), 1),
            "wind_regime"       : (
                "Below cut-in" if speed < CUT_IN_SPEED else
                "Cut-out (safety)" if speed > CUT_OUT_SPEED else
                "Rated power" if speed >= RATED_SPEED else "Partial"
            ),
        }

    def predict_forecast(self, forecast_list: list) -> list:
        return [{"timestamp": f["timestamp"], **self.predict(f)} for f in forecast_list]
