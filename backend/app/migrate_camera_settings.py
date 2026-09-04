import sqlite3

conn = sqlite3.connect("civiclens.db")
cursor = conn.cursor()

cursor.execute("PRAGMA table_info(cameras)")
existing_columns = {row[1] for row in cursor.fetchall()}

if "purpose" not in existing_columns:
    cursor.execute("ALTER TABLE cameras ADD COLUMN purpose TEXT DEFAULT 'Custom'")
    print("Added 'purpose' column.")
else:
    print("'purpose' column already exists, skipping.")

if "enabled_detections" not in existing_columns:
    cursor.execute("ALTER TABLE cameras ADD COLUMN enabled_detections TEXT")
    print("Added 'enabled_detections' column.")
else:
    print("'enabled_detections' column already exists, skipping.")

cursor.execute("UPDATE cameras SET purpose = 'Custom' WHERE purpose IS NULL")
cursor.execute(
    "UPDATE cameras SET enabled_detections = '[\"vehicle_parking\", \"crowd\", \"road_events\"]' "
    "WHERE enabled_detections IS NULL"
)
conn.commit()
conn.close()
print("Migration complete. Existing cameras preserved with full detection defaults (matches prior behavior).")
