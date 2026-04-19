"""
=============================================================================
RenewCast AI — ML Model Trainer
=============================================================================
Trains Random Forest regressors on the generated (Kaggle-schema) datasets.
70 / 30 train / test split — random_state=42

Models trained:
  • SolarPowerModel  → predicts AC_POWER / solar_power (kW)
  • WindPowerModel   → predicts Active Power (kW)

Metrics reported: R², MAE, RMSE (train and test sets)
=============================================================================
"""

import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import cross_val_score
import joblib, os, sys

# ── feature lists (must match generate_dataset.py) ────────────────────────
SOLAR_FEATURES = [
    "IRRADIATION", "AMBIENT_TEMPERATURE", "MODULE_TEMPERATURE",
    "cloud_cover", "humidity", "hour", "month",
    "is_daytime", "clear_sky_index", "temp_factor",
    "hour_sin", "hour_cos", "month_sin", "month_cos",
]
SOLAR_TARGET = "solar_power"

WIND_FEATURES = [
    "Wind Speed (m/s)", "wind_speed_squared", "wind_speed_cubed",
    "Temperature (°C)", "Humidity (%)", "Pressure (hPa)",
    "air_density", "wind_power_density",
    "hour", "month", "hour_sin", "hour_cos",
    "month_sin", "month_cos", "wind_dir_sin", "wind_dir_cos",
]
WIND_TARGET = "Active Power (kW)"


def load_csvs(data_dir):
    paths = {
        "solar_train": os.path.join(data_dir, "solar_train.csv"),
        "solar_test" : os.path.join(data_dir, "solar_test.csv"),
        "wind_train" : os.path.join(data_dir, "wind_train.csv"),
        "wind_test"  : os.path.join(data_dir, "wind_test.csv"),
    }
    for k, p in paths.items():
        if not os.path.exists(p):
            sys.exit(f"❌  Missing: {p}\n    Run  python generate_dataset.py  first.")
    dfs = {k: pd.read_csv(p) for k, p in paths.items()}
    print(f"  ✓ solar_train.csv : {len(dfs['solar_train']):,} rows")
    print(f"  ✓ solar_test.csv  : {len(dfs['solar_test']):,} rows")
    print(f"  ✓ wind_train.csv  : {len(dfs['wind_train']):,} rows")
    print(f"  ✓ wind_test.csv   : {len(dfs['wind_test']):,} rows")
    return dfs


def print_metrics(split_name, y_true, y_pred):
    r2   = r2_score(y_true, y_pred)
    mae  = mean_absolute_error(y_true, y_pred)
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))
    print(f"    {split_name:<12}  R²={r2:.4f}   MAE={mae:.3f} kW   RMSE={rmse:.3f} kW")
    return r2, mae, rmse


def train_solar(dfs, models_dir):
    print("\n" + "─" * 60)
    print("  SOLAR MODEL — Random Forest Regressor")
    print("─" * 60)

    Xtr = dfs["solar_train"][SOLAR_FEATURES]
    ytr = dfs["solar_train"][SOLAR_TARGET]
    Xte = dfs["solar_test"][SOLAR_FEATURES]
    yte = dfs["solar_test"][SOLAR_TARGET]

    scaler = StandardScaler()
    Xtr_s  = scaler.fit_transform(Xtr)
    Xte_s  = scaler.transform(Xte)

    model = RandomForestRegressor(
        n_estimators=200, max_depth=25,
        min_samples_leaf=2, max_features="sqrt",
        random_state=42, n_jobs=-1
    )
    model.fit(Xtr_s, ytr)

    print_metrics("Train (70%)", ytr, model.predict(Xtr_s))
    r2, mae, rmse = print_metrics("Test  (30%)", yte, model.predict(Xte_s))

    # Feature importance
    imp = pd.Series(model.feature_importances_, index=SOLAR_FEATURES).sort_values(ascending=False)
    print("\n    Top-5 feature importances:")
    for feat, val in imp.head(5).items():
        print(f"      {feat:<30} {val:.4f}")

    # Save
    joblib.dump(model,  os.path.join(models_dir, "solar_model.pkl"))
    joblib.dump(scaler, os.path.join(models_dir, "solar_scaler.pkl"))
    print(f"\n  ✓ solar_model.pkl  saved")
    return {"r2": r2, "mae": mae, "rmse": rmse}


def train_wind(dfs, models_dir):
    print("\n" + "─" * 60)
    print("  WIND MODEL — Random Forest Regressor")
    print("─" * 60)

    Xtr = dfs["wind_train"][WIND_FEATURES]
    ytr = dfs["wind_train"][WIND_TARGET]
    Xte = dfs["wind_test"][WIND_FEATURES]
    yte = dfs["wind_test"][WIND_TARGET]

    scaler = StandardScaler()
    Xtr_s  = scaler.fit_transform(Xtr)
    Xte_s  = scaler.transform(Xte)

    model = RandomForestRegressor(
        n_estimators=200, max_depth=25,
        min_samples_leaf=2, max_features="sqrt",
        random_state=42, n_jobs=-1
    )
    model.fit(Xtr_s, ytr)

    print_metrics("Train (70%)", ytr, model.predict(Xtr_s))
    r2, mae, rmse = print_metrics("Test  (30%)", yte, model.predict(Xte_s))

    imp = pd.Series(model.feature_importances_, index=WIND_FEATURES).sort_values(ascending=False)
    print("\n    Top-5 feature importances:")
    for feat, val in imp.head(5).items():
        print(f"      {feat:<30} {val:.4f}")

    joblib.dump(model,  os.path.join(models_dir, "wind_model.pkl"))
    joblib.dump(scaler, os.path.join(models_dir, "wind_scaler.pkl"))
    print(f"\n  ✓ wind_model.pkl   saved")
    return {"r2": r2, "mae": mae, "rmse": rmse}


def main():
    print("=" * 60)
    print("  RenewCast AI — Model Trainer  (70/30 split, RF)")
    print("=" * 60)

    base_dir   = os.path.dirname(__file__)
    data_dir   = os.path.join(base_dir, "data")
    models_dir = os.path.join(base_dir, "trained_models")
    os.makedirs(models_dir, exist_ok=True)

    print("\n── Loading datasets ───────────────────────────────────────────")
    dfs = load_csvs(data_dir)

    solar_metrics = train_solar(dfs, models_dir)
    wind_metrics  = train_wind(dfs, models_dir)

    print("\n" + "=" * 60)
    print("  TRAINING COMPLETE")
    print("=" * 60)
    print(f"  Solar → R²={solar_metrics['r2']:.4f}  MAE={solar_metrics['mae']:.3f} kW")
    print(f"  Wind  → R²={wind_metrics['r2']:.4f}  MAE={wind_metrics['mae']:.3f} kW")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    main()
