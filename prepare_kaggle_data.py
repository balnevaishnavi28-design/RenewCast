"""
=============================================================================
RenewCast AI — Kaggle Dataset Preparation Script
=============================================================================
Reads the REAL Kaggle CSV files, merges, cleans, engineers features,
splits 70/30, and saves ready-to-train CSV files.

FILES REQUIRED in  backend/data/kaggle_raw/ :
  Plant_1_Generation_Data.csv     (Solar generation  — Kaggle: anikannal)
  Plant_1_Weather_Sensor_Data.csv (Solar weather     — Kaggle: anikannal)
  Turbine_Data.csv                (Wind turbine data — Kaggle: theforcecoder)

WHY generate_dataset.py IS REMOVED:
  We now have the real Kaggle data. generate_dataset.py was only needed as
  a fallback when no real data was available. It is no longer required.

RUN ORDER:
  1. python prepare_kaggle_data.py   <- this file (creates train/test CSVs)
  2. python model_trainer.py         <- trains the ML models
  3. python app.py                   <- starts the web server
=============================================================================
"""

import pandas as pd
import numpy as np
import math, os, sys
from sklearn.model_selection import train_test_split

BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
RAW_DIR     = os.path.join(BASE_DIR, "data", "kaggle_raw")
OUT_DIR     = os.path.join(BASE_DIR, "data")
os.makedirs(OUT_DIR, exist_ok=True)

SEED        = 42
TRAIN_RATIO = 0.70

SOLAR_GEN  = os.path.join(RAW_DIR, "Plant_1_Generation_Data.csv")
SOLAR_WTH  = os.path.join(RAW_DIR, "Plant_1_Weather_Sensor_Data.csv")
WIND_FILE  = os.path.join(RAW_DIR, "Turbine_Data.csv")


def check_files():
    missing = [p for p in [SOLAR_GEN, SOLAR_WTH, WIND_FILE] if not os.path.exists(p)]
    if missing:
        print("\n ERROR — Missing files:")
        for m in missing: print(f"    {m}")
        sys.exit(1)
    print("  All Kaggle raw files found.")


def split_save(df, prefix, target_col, date_col):
    train_df, test_df = train_test_split(
        df, test_size=1-TRAIN_RATIO, random_state=SEED, shuffle=True)
    train_df = train_df.sort_values(date_col).reset_index(drop=True)
    test_df  = test_df.sort_values(date_col).reset_index(drop=True)
    for tag, d in [("train", train_df), ("test", test_df), ("full", df)]:
        d.to_csv(os.path.join(OUT_DIR, f"{prefix}_{tag}.csv"), index=False)
    print(f"  {prefix}_train.csv : {len(train_df):,} rows (70%)")
    print(f"  {prefix}_test.csv  : {len(test_df):,} rows  (30%)")
    print(f"  {prefix}_full.csv  : {len(df):,} rows")
    print(f"  Target range      : {df[target_col].min():.3f} - {df[target_col].max():.3f}  (mean {df[target_col].mean():.3f})")


def prepare_solar():
    print("\n--- SOLAR (Plant_1 Kaggle dataset) ---")
    gen = pd.read_csv(SOLAR_GEN)
    gen.columns = [c.strip() for c in gen.columns]
    gen["DATE_TIME"] = pd.to_datetime(gen["DATE_TIME"], dayfirst=True, errors="coerce")
    gen = gen.dropna(subset=["DATE_TIME","AC_POWER"]).sort_values("DATE_TIME")
    # Sum all inverters per timestamp
    gen = gen.groupby("DATE_TIME", as_index=False).agg(
        DC_POWER=("DC_POWER","sum"), AC_POWER=("AC_POWER","sum"))
    print(f"  Generation rows: {len(gen):,}")

    wth = pd.read_csv(SOLAR_WTH)
    wth.columns = [c.strip() for c in wth.columns]
    wth["DATE_TIME"] = pd.to_datetime(wth["DATE_TIME"], errors="coerce")
    wth = wth.dropna(subset=["DATE_TIME"]).sort_values("DATE_TIME")
    wth = wth.groupby("DATE_TIME", as_index=False).agg(
        AMBIENT_TEMPERATURE=("AMBIENT_TEMPERATURE","mean"),
        MODULE_TEMPERATURE=("MODULE_TEMPERATURE","mean"),
        IRRADIATION=("IRRADIATION","mean"))
    print(f"  Weather rows   : {len(wth):,}")

    df = pd.merge_asof(gen.sort_values("DATE_TIME"), wth.sort_values("DATE_TIME"),
                       on="DATE_TIME", tolerance=pd.Timedelta("20min"), direction="nearest")
    df = df.dropna(subset=["AC_POWER","IRRADIATION","AMBIENT_TEMPERATURE"])
    print(f"  After merge    : {len(df):,}")

    df["hour"]  = df["DATE_TIME"].dt.hour
    df["month"] = df["DATE_TIME"].dt.month
    if "MODULE_TEMPERATURE" not in df.columns or df["MODULE_TEMPERATURE"].isna().all():
        df["MODULE_TEMPERATURE"] = df["AMBIENT_TEMPERATURE"] + 0.0256*df["IRRADIATION"]
    df["MODULE_TEMPERATURE"] = df["MODULE_TEMPERATURE"].fillna(
        df["AMBIENT_TEMPERATURE"] + 0.0256*df["IRRADIATION"])

    df["is_daytime"]      = ((df["hour"]>=6) & (df["hour"]<=18)).astype(int)
    elev                  = df["hour"].apply(lambda h: max(math.sin(math.pi*(h-6)/12), 0))
    clear_ghi             = 1000*elev
    df["clear_sky_index"] = (df["IRRADIATION"]/clear_ghi.clip(lower=1)).clip(0,1)
    df["cloud_cover"]     = ((1-df["clear_sky_index"])*100).round(2)
    df["temp_factor"]     = (1 - 0.004*(df["MODULE_TEMPERATURE"]-25)).clip(0.7,1.1)
    df["humidity"]        = (40 + 0.5*df["cloud_cover"]).clip(15,100)
    df["hour_sin"]        = np.sin(2*np.pi*df["hour"]/24).round(4)
    df["hour_cos"]        = np.cos(2*np.pi*df["hour"]/24).round(4)
    df["month_sin"]       = np.sin(2*np.pi*df["month"]/12).round(4)
    df["month_cos"]       = np.cos(2*np.pi*df["month"]/12).round(4)
    df["solar_power"]     = df["AC_POWER"].clip(lower=0).round(3)

    cols = ["DATE_TIME","DC_POWER","AC_POWER","IRRADIATION",
            "AMBIENT_TEMPERATURE","MODULE_TEMPERATURE",
            "cloud_cover","humidity","hour","month",
            "is_daytime","clear_sky_index","temp_factor",
            "hour_sin","hour_cos","month_sin","month_cos","solar_power"]
    df = df[[c for c in cols if c in df.columns]]
    print(f"  Final shape    : {df.shape}")
    return df


def prepare_wind():
    print("\n--- WIND (Turbine_Data.csv Kaggle dataset) ---")
    df = pd.read_csv(WIND_FILE, index_col=0, parse_dates=True)
    df.index.name = "Datetime"
    df = df.reset_index()
    df["Datetime"] = pd.to_datetime(df["Datetime"], utc=True, errors="coerce").dt.tz_localize(None)
    df = df.dropna(subset=["Datetime"]).sort_values("Datetime").reset_index(drop=True)

    rename = {"ActivePower":"Active Power (kW)",
               "AmbientTemperatue":"Temperature (°C)",
               "AmbientTemperature":"Temperature (°C)",
               "WindSpeed":"Wind Speed (m/s)",
               "WindDirection":"Wind Direction (°)"}
    df = df.rename(columns={k:v for k,v in rename.items() if k in df.columns})

    df = df.dropna(subset=["Wind Speed (m/s)","Active Power (kW)"])
    df["Active Power (kW)"] = df["Active Power (kW)"].clip(lower=0)
    print(f"  Usable rows    : {len(df):,}")

    for col, default in [("Temperature (°C)",20.0),("Humidity (%)",60.0),
                         ("Pressure (hPa)",1013.25),("Wind Direction (°)",0.0)]:
        if col not in df.columns: df[col] = default
        df[col] = df[col].fillna(default)

    ws = df["Wind Speed (m/s)"]
    T  = df["Temperature (°C)"]
    P  = df["Pressure (hPa)"]
    Wd = df["Wind Direction (°)"]

    df["wind_speed_squared"] = (ws**2).round(3)
    df["wind_speed_cubed"]   = (ws**3).round(3)
    df["air_density"]        = ((P*100)/(287.05*(T+273.15))).round(4)
    df["wind_power_density"] = (0.5*df["air_density"]*df["wind_speed_cubed"]).round(3)
    df["hour"]               = df["Datetime"].dt.hour
    df["month"]              = df["Datetime"].dt.month
    df["hour_sin"]           = np.sin(2*np.pi*df["hour"]/24).round(4)
    df["hour_cos"]           = np.cos(2*np.pi*df["hour"]/24).round(4)
    df["month_sin"]          = np.sin(2*np.pi*df["month"]/12).round(4)
    df["month_cos"]          = np.cos(2*np.pi*df["month"]/12).round(4)
    df["wind_dir_sin"]       = np.sin(np.radians(Wd)).round(4)
    df["wind_dir_cos"]       = np.cos(np.radians(Wd)).round(4)

    cols = ["Datetime","Wind Speed (m/s)","Wind Direction (°)","Temperature (°C)",
            "Humidity (%)","Pressure (hPa)",
            "wind_speed_squared","wind_speed_cubed","air_density","wind_power_density",
            "hour","month","hour_sin","hour_cos","month_sin","month_cos",
            "wind_dir_sin","wind_dir_cos","Active Power (kW)"]
    df = df[[c for c in cols if c in df.columns]]
    print(f"  Final shape    : {df.shape}")
    return df


def main():
    print("="*60)
    print("  RenewCast AI — Kaggle Data Preparation")
    print(f"  Train {int(TRAIN_RATIO*100)}% / Test {int((1-TRAIN_RATIO)*100)}% | seed={SEED}")
    print("="*60)
    check_files()
    solar_df = prepare_solar()
    split_save(solar_df, "solar", "solar_power", "DATE_TIME")
    wind_df  = prepare_wind()
    split_save(wind_df,  "wind", "Active Power (kW)", "Datetime")
    print("\n  Done. Now run: python model_trainer.py\n")

if __name__ == "__main__":
    main()
