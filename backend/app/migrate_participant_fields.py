"""One-off migration: add external-source fields to the participants table so
records imported from external databases (NADRA, Excel exports, etc.) keep
their source data. Idempotent — existing columns are left alone."""
import sqlite3

from app.config import BASE_DIR

COLUMNS = {
    "external_id": "VARCHAR",
    "phone": "VARCHAR",
    "address": "VARCHAR",
    "notes": "VARCHAR",
    "source": "VARCHAR",
}


def migrate():
    import os
    db_path = os.path.join(BASE_DIR, "civiclens.db")
    con = sqlite3.connect(db_path)
    try:
        existing = {row[1] for row in con.execute("PRAGMA table_info(participants)").fetchall()}
        added = []
        for name, ddl in COLUMNS.items():
            if name not in existing:
                con.execute(f"ALTER TABLE participants ADD COLUMN {name} {ddl}")
                added.append(name)
        con.commit()
        if added:
            print(f"[migrate_participant_fields] added columns: {', '.join(added)}")
    finally:
        con.close()


if __name__ == "__main__":
    migrate()
