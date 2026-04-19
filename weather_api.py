"""
Weather API — fetches current conditions + 48-hour forecast
from OpenWeatherMap (free tier, v2.5).
"""

import requests, math, os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

API_KEY  = os.getenv("OPENWEATHER_API_KEY", "")
BASE_URL = "https://api.openweathermap.org/data/2.5"


class WeatherAPI:
    def __init__(self):
        self.api_key = API_KEY or os.getenv("OPENWEATHER_API_KEY", "")

    # ── resolve city → lat/lon ──────────────────────────────────────────
    def _geo(self, city: str):
        r = requests.get(
            "http://api.openweathermap.org/geo/1.0/direct",
            params={"q": city, "limit": 1, "appid": self.api_key},
            timeout=10,
        )
        r.raise_for_status()
        data = r.json()
        if not data:
            raise ValueError(f"City not found: {city}")
        return data[0]["lat"], data[0]["lon"], data[0].get("name", city)

    # ── current weather ─────────────────────────────────────────────────
    def _current(self, lat, lon):
        r = requests.get(
            f"{BASE_URL}/weather",
            params={"lat": lat, "lon": lon, "appid": self.api_key,
                    "units": "metric"},
            timeout=10,
        )
        r.raise_for_status()
        return r.json()

    # ── 5-day / 3-hour forecast → 48-h ──────────────────────────────────
    def _forecast(self, lat, lon):
        r = requests.get(
            f"{BASE_URL}/forecast",
            params={"lat": lat, "lon": lon, "appid": self.api_key,
                    "units": "metric", "cnt": 16},
            timeout=10,
        )
        r.raise_for_status()
        return r.json()

    # ── solar irradiance estimate from cloud cover ───────────────────────
    @staticmethod
    def _irradiance(clouds: float, hour: int) -> float:
        if hour < 6 or hour > 19:
            return 0.0
        angle = math.sin(math.pi * (hour - 6) / 13)
        return round(1000 * angle * (1 - 0.75 * clouds / 100), 2)

    # ── public interface ─────────────────────────────────────────────────
    def get_weather(self, city=None, lat=None, lon=None):
        if city:
            lat, lon, location_name = self._geo(city)
        else:
            location_name = f"{lat:.3f}, {lon:.3f}"

        cur  = self._current(lat, lon)
        fore = self._forecast(lat, lon)

        hour      = __import__("datetime").datetime.utcnow().hour
        clouds    = cur["clouds"]["all"]
        irr       = self._irradiance(clouds, hour)

        current = {
            "location"        : location_name,
            "lat"             : round(lat, 4),
            "lon"             : round(lon, 4),
            "temperature"     : cur["main"]["temp"],
            "humidity"        : cur["main"]["humidity"],
            "pressure"        : cur["main"]["pressure"],
            "wind_speed"      : cur["wind"]["speed"],
            "wind_direction"  : cur["wind"].get("deg", 0),
            "cloud_cover"     : clouds,
            "solar_irradiance": irr,
            "weather_desc"    : cur["weather"][0]["description"],
            "hour"            : hour,
            "month"           : __import__("datetime").datetime.utcnow().month,
        }

        forecasts = []
        for item in fore["list"]:
            h   = int(item["dt_txt"][11:13])
            cl  = item["clouds"]["all"]
            forecasts.append({
                "timestamp"       : item["dt_txt"],
                "temperature"     : item["main"]["temp"],
                "humidity"        : item["main"]["humidity"],
                "pressure"        : item["main"]["pressure"],
                "wind_speed"      : item["wind"]["speed"],
                "wind_direction"  : item["wind"].get("deg", 0),
                "cloud_cover"     : cl,
                "solar_irradiance": self._irradiance(cl, h),
                "hour"            : h,
                "month"           : int(item["dt_txt"][5:7]),
            })

        return current, {"forecasts": forecasts}
