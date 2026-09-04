"""
Event type seed: inserts the default civic-event catalog if missing.
Called automatically from main.py on every boot — safe to call multiple times.
"""

from app.database import SessionLocal
from app.models.event_type import EventType

EVENT_TYPES = [
    ("proper_disposal",      "Proper waste disposal",     "positive",  1,  "Item placed in bin zone"),
    ("pedestrian_crossing",  "Used pedestrian crossing",  "positive",  1,  "Crossed within crosswalk polygon"),
    ("queue_discipline",     "Queue discipline",           "positive",  1,  "Maintained order/spacing in queue zone"),
    ("littering",            "Littering",                  "negative", -2,  "Item left outside bin zone"),
    ("jaywalking",           "Jaywalking",                 "negative", -1,  "Crossed road outside crosswalk polygon"),
    ("loitering",            "Loitering",                  "negative", -2,  "Dwell time in restricted zone exceeded"),
]


def seed_event_types():
    db = SessionLocal()
    try:
        created = 0
        for event_type_id, display_name, category, score_delta, description in EVENT_TYPES:
            if db.query(EventType).filter(EventType.event_type_id == event_type_id).first():
                continue
            db.add(EventType(
                event_type_id=event_type_id,
                display_name=display_name,
                category=category,
                score_delta=score_delta,
                description=description,
            ))
            created += 1
        if created:
            db.commit()
            print(f"[seed_event_types] created {created} event type(s)")
    finally:
        db.close()


if __name__ == "__main__":
    seed_event_types()
