"""Solar power prediction model — wraps the trained Random Forest."""

import numpy as np, joblib, os, math

MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "trained_models")

SOLAR_FEATURES = [
    "IRRADIATION", "AMBIENT_TEMPERATURE", "MODULE_TEMPERATURE",
    "cloud_cover", "humidity", "hour", "month",
    "is_daytime", "clear_sky_index", "temp_factor",
    "hour_sin", "hour_cos", "month_sin", "month_cos",
]


class SolarPowerPredictor:
    def __init__(self):
        model_path  = os.path.join(MODELS_DIR, "solar_model.pkl")
        scaler_path = os.path.join(MODELS_DIR, "solar_scaler.pkl")
        if os.path.exists(model_path):
            self._model  = joblib.load(model_path)
            self._scaler = joblib.load(scaler_path)
            self._ready  = True
        else:
            self._ready  = False

    def _build_features(self, w: dict) -> list:
        hour  = w.get("hour", 12)
        month = w.get("month", 6)
        irr   = w.get("solar_irradiance", 0)
        temp  = w.get("temperature", 25)
        cl    = w.get("cloud_cover", 0)

        module_temp   = temp + 0.0256 * irr
        is_daytime    = 1 if 6 <= hour <= 18 else 0
        clear_sky_ghi = 1000 * max(math.sin(math.pi * (hour - 6) / 12), 0)
        clear_sky_idx = (irr / clear_sky_ghi) if clear_sky_ghi > 0 else 0.0
        clear_sky_idx = min(max(clear_sky_idx, 0), 1)
        temp_factor   = max(min(1 - 0.004 * (module_temp - 25), 1.1), 0.7)

        return [
            irr, temp, module_temp,
            cl, w.get("humidity", 50),
            hour, month,
            is_daytime, round(clear_sky_idx, 4), round(temp_factor, 4),
            math.sin(2 * math.pi * hour / 24),
            math.cos(2 * math.pi * hour / 24),
            math.sin(2 * math.pi * month / 12),
            math.cos(2 * math.pi * month / 12),
        ]

    def _physics_fallback(self, w: dict) -> float:
        """Simple physics model used when no trained model is available."""
        hour  = w.get("hour", 12)
        irr   = w.get("solar_irradiance", 0)
        temp  = w.get("temperature", 25)
        cl    = w.get("cloud_cover", 0)
        is_day = 1 if 6 <= hour <= 18 else 0
        module_temp = temp + 0.0256 * irr
        temp_factor = max(min(1 - 0.004 * (module_temp - 25), 1.1), 0.7)
        cloud_factor = 1 - 0.75 * cl / 100
        return round(max(irr / 1000 * 1.6 * 0.20 * 100 * temp_factor * cloud_factor * is_day, 0), 3)

    def predict(self, weather: dict) -> dict:
        if self._ready:
            feats = np.array(self._build_features(weather)).reshape(1, -1)
            feats_s = self._scaler.transform(feats)
            power = float(max(self._model.predict(feats_s)[0], 0))
        else:
            power = self._physics_fallback(weather)

        hour = weather.get("hour", 12)
        return {
            "predicted_power_kw": round(power, 3),
            "efficiency_pct"    : round(min(power / 35 * 100, 100), 1),
            "is_daytime"        : 1 if 6 <= hour <= 18 else 0,
        }

    def predict_forecast(self, forecast_list: list) -> list:
        return [{"timestamp": f["timestamp"], **self.predict(f)} for f in forecast_list]
