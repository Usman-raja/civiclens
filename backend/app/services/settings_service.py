from sqlalchemy.orm import Session

from app.models.setting import Setting

SETTINGS_SCHEMA = {
    "match_threshold": (0.5, float, 0.3, 0.95, "Face match strictness",
                        "How similar a face must be to count as a known participant. Higher = stricter."),
    "redlist_match_threshold": (0.5, float, 0.3, 0.95, "Watchlist match strictness",
                                "Same idea, for Watchlist matches. Keep reasonably high to avoid false hits."),
    "missing_person_match_threshold": (0.5, float, 0.3, 0.95, "Missing person match strictness",
                                       "Same idea, for Missing Person matches."),
    "unknown_match_threshold": (0.5, float, 0.3, 0.95, "Unknown-face grouping strictness",
                                "How similar two unknown faces must be to be treated as the same person."),
    "duplicate_review_threshold": (0.45, float, 0.3, 0.95, "Duplicate-on-registration sensitivity",
                                   "When registering, how similar to an existing record before warning of a duplicate."),
    "crowd_threshold": (4, int, 2, 100, "Crowd size trigger",
                        "How many people in the crowd zone before a crowd alert fires."),
    "loiter_seconds": (10, int, 3, 600, "Loitering dwell time (seconds)",
                       "How long a person stays in a restricted zone before it counts as loitering."),
    "vehicle_dwell_seconds": (15, int, 5, 3600, "Illegal-parking dwell time (seconds)",
                              "How long a vehicle stays in a no-parking zone before it counts as illegal parking."),
    "blur_threshold": (40.0, float, 5.0, 500.0, "Registration photo sharpness minimum",
                       "Minimum sharpness for a registration photo. Lower = accepts blurrier photos."),
    "unattended_object_seconds": (20, int, 5, 600, "Unattended object dwell time (seconds)",
                                  "How long a bag/suitcase must be left alone (no nearby person) before raising an alert."),
    "crowd_surge_threshold": (5, int, 2, 50, "Crowd surge sensitivity (persons)",
                              "How many additional people must enter the crowd zone within the surge window to trigger a stampede-risk alert."),
    "crowd_surge_window_seconds": (30, int, 5, 300, "Crowd surge detection window (seconds)",
                                   "Time window for measuring crowd growth rate. Shorter = more sensitive."),
    "accident_fallen_seconds": (5, int, 2, 60, "Fallen-person confirm time (seconds)",
                                "How long a person must appear to be lying on the road before a road-accident alert fires."),
    "accident_vehicle_stop_seconds": (10, int, 3, 300, "Stopped-vehicle accident time (seconds)",
                                      "How long a vehicle must sit on the road with a person alongside before a road-accident alert fires."),
}


def get_setting(db: Session, key: str):
    if key not in SETTINGS_SCHEMA:
        raise KeyError(f"Unknown setting: {key}")
    default, typ, _min, _max, _label, _help = SETTINGS_SCHEMA[key]
    row = db.query(Setting).filter(Setting.key == key).first()
    if row is None:
        return default
    try:
        return typ(row.value)
    except (ValueError, TypeError):
        return default


def get_all_settings(db: Session):
    result = []
    for key, (default, typ, mn, mx, label, help_text) in SETTINGS_SCHEMA.items():
        result.append({
            "key": key,
            "value": get_setting(db, key),
            "default": default,
            "min": mn,
            "max": mx,
            "type": "float" if typ is float else "int",
            "label": label,
            "help": help_text,
        })
    return result


def set_setting(db: Session, key: str, value):
    if key not in SETTINGS_SCHEMA:
        raise KeyError(f"Unknown setting: {key}")
    default, typ, mn, mx, _label, _help = SETTINGS_SCHEMA[key]
    try:
        coerced = typ(value)
    except (ValueError, TypeError):
        raise ValueError(f"{key} must be a {typ.__name__}")
    if coerced < mn or coerced > mx:
        raise ValueError(f"{key} must be between {mn} and {mx}")
    row = db.query(Setting).filter(Setting.key == key).first()
    if row is None:
        row = Setting(key=key, value=str(coerced))
        db.add(row)
    else:
        row.value = str(coerced)
    db.commit()
    return coerced
