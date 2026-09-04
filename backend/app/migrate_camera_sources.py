"""One-off migration: add stream source columns to the cameras table so each
camera can be monitored server-side. Idempotent — existing columns are left
alone, so it is safe to run on every boot."""
import sqlite3

from app.config import BASE_DIR

COLUMNS = {
    "source_type": "VARCHAR NOT NULL DEFAULT 'manual'",
    "source_path": "VARCHAR",
    "capture_interval": "INTEGER NOT NULL DEFAULT 5",
    "monitoring_enabled": "INTEGER NOT NULL DEFAULT 0",
}


def migrate():
    import os
    db_path = os.path.join(BASE_DIR, "civiclens.db")
    con = sqlite3.connect(db_path)
    try:
        existing = {row[1] for row in con.execute("PRAGMA table_info(cameras)").fetchall()}
        added = []
        for name, ddl in COLUMNS.items():
            if name not in existing:
                con.execute(f"ALTER TABLE cameras ADD COLUMN {name} {ddl}")
                added.append(name)
        con.commit()
        if added:
            print(f"[migrate_camera_sources] added columns: {', '.join(added)}")
    finally:
        con.close()


if __name__ == "__main__":
    migrate()
