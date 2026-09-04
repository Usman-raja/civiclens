"""
Camera seed: creates the standard CivicLens city-monitoring camera set on first boot.
Called automatically from main.py. Safe to call multiple times — skips existing cameras.

Cameras cover every detection scenario the system supports across typical city deployments:
  - Face recognition (runs on all cameras automatically via the detect endpoint)
  - Crowd detection + surge risk  →  crowd_zone
  - Jaywalking / pedestrian crossing  →  road + crosswalk zones
  - Loitering in restricted areas  →  restricted_zone
  - Illegal parking  →  no_parking_zone
  - Unattended objects  →  enabled wherever crowd/road_events are active
"""

import json
from app.database import SessionLocal
from app.models.camera import Camera

# Each entry: (camera_name, purpose, enabled_detections, zone_config)
# Zones are polygons as list of [x, y] in 0-1000 normalized space
# (the same coordinate scale the Zone Editor uses).
_CAMERAS = [
    # ── 1. Major Traffic Intersection ───────────────────────────────────────
    # Covers all lanes of a 4-way intersection.
    # Detects jaywalking, illegal parking on yellow box, vehicle dwell, pedestrian surge.
    (
        "intersection-cam-north",
        "Traffic Intersection — North Approach",
        ["vehicle_parking", "road_events", "crowd"],
        {
            "road":            [[0, 200],    [1000, 200],  [1000, 800],  [0, 800]],
            "crosswalk":       [[350, 750],  [650, 750],   [650, 900],   [350, 900]],
            "no_parking_zone": [[0, 200],    [200, 200],   [200, 800],   [0, 800]],
            "restricted_zone": [[400, 380],  [600, 380],   [600, 620],   [400, 620]],
            "crowd_zone":      [[200, 750],  [800, 750],   [800, 1000],  [200, 1000]],
        },
    ),
    (
        "intersection-cam-south",
        "Traffic Intersection — South Approach",
        ["vehicle_parking", "road_events", "crowd"],
        {
            "road":            [[0, 200],    [1000, 200],  [1000, 800],  [0, 800]],
            "crosswalk":       [[350, 100],  [650, 100],   [650, 250],   [350, 250]],
            "no_parking_zone": [[800, 200],  [1000, 200],  [1000, 800],  [800, 800]],
            "restricted_zone": [[400, 380],  [600, 380],   [600, 620],   [400, 620]],
            "crowd_zone":      [[200, 0],    [800, 0],     [800, 250],   [200, 250]],
        },
    ),

    # ── 2. City Main Square / Public Plaza ──────────────────────────────────
    # Open civic space — large crowd_zone covering entire square.
    # Restricted zone around monument/fountain. Crosswalk on all four sides.
    (
        "city-square-cam",
        "City Main Square — Central Plaza",
        ["crowd", "road_events"],
        {
            "crowd_zone":      [[50, 50],    [950, 50],    [950, 950],   [50, 950]],
            "restricted_zone": [[380, 380],  [620, 380],   [620, 620],   [380, 620]],
            "crosswalk":       [[300, 880],  [700, 880],   [700, 1000],  [300, 1000]],
            "road":            [[0, 880],    [1000, 880],  [1000, 1000], [0, 1000]],
        },
    ),

    # ── 3. Central Bus Terminal ──────────────────────────────────────────────
    # High-footfall transit hub. Crowd monitoring at bay areas, loitering at
    # restricted bus bays, no-parking on drop-off lanes.
    (
        "bus-terminal-cam",
        "Central Bus Terminal — Arrival Hall",
        ["vehicle_parking", "crowd", "road_events"],
        {
            "crowd_zone":      [[0, 400],    [1000, 400],  [1000, 1000], [0, 1000]],
            "no_parking_zone": [[0, 0],      [1000, 0],    [1000, 300],  [0, 300]],
            "restricted_zone": [[700, 300],  [1000, 300],  [1000, 700],  [700, 700]],
            "crosswalk":       [[350, 280],  [650, 280],   [650, 420],   [350, 420]],
            "road":            [[0, 100],    [1000, 100],  [1000, 350],  [0, 350]],
        },
    ),

    # ── 4. Railway / Metro Station Entrance ─────────────────────────────────
    # Entrance plaza with turnstile area as restricted zone.
    # Surge detection for morning/evening rush, unattended luggage zone.
    (
        "metro-station-cam",
        "Metro Station — Main Entrance",
        ["crowd", "road_events"],
        {
            "crowd_zone":      [[0, 300],    [1000, 300],  [1000, 1000], [0, 1000]],
            "restricted_zone": [[300, 0],    [700, 0],     [700, 300],   [300, 300]],
            "crosswalk":       [[250, 850],  [750, 850],   [750, 1000],  [250, 1000]],
            "road":            [[0, 820],    [1000, 820],  [1000, 1000], [0, 1000]],
        },
    ),

    # ── 5. Stadium / Sports & Events Venue ──────────────────────────────────
    # Entry gates and outer concourse. Very high crowd thresholds.
    # Restricted zone at VIP/player entrance. No parking on access road.
    (
        "stadium-gate-cam",
        "Stadium — Main Gate & Concourse",
        ["crowd", "vehicle_parking", "road_events"],
        {
            "crowd_zone":      [[0, 0],      [1000, 0],    [1000, 800],  [0, 800]],
            "restricted_zone": [[400, 0],    [600, 0],     [600, 250],   [400, 250]],
            "no_parking_zone": [[0, 800],    [500, 800],   [500, 1000],  [0, 1000]],
            "crosswalk":       [[300, 700],  [700, 700],   [700, 850],   [300, 850]],
            "road":            [[0, 750],    [1000, 750],  [1000, 1000], [0, 1000]],
        },
    ),

    # ── 6. Open-Air Market / Bazaar ──────────────────────────────────────────
    # Dense pedestrian shopping area. Restricted zone at fire exits.
    # Crowd monitoring for the entire market floor. Vehicle access road on perimeter.
    (
        "market-bazaar-cam",
        "Central Market — Main Bazaar Area",
        ["crowd", "road_events", "vehicle_parking"],
        {
            "crowd_zone":      [[50, 50],    [950, 50],    [950, 750],   [50, 750]],
            "restricted_zone": [[0, 0],      [150, 0],     [150, 400],   [0, 400]],
            "road":            [[0, 800],    [1000, 800],  [1000, 1000], [0, 1000]],
            "no_parking_zone": [[700, 750],  [1000, 750],  [1000, 1000], [700, 1000]],
            "crosswalk":       [[400, 750],  [600, 750],   [600, 900],   [400, 900]],
        },
    ),

    # ── 7. City Park & Recreational Area ─────────────────────────────────────
    # Large park with crowd zones at amphitheatre/events lawn.
    # Restricted zone at children's play area (no loitering by adults alone).
    # Road along park perimeter for vehicle monitoring.
    (
        "city-park-cam",
        "City Park — Events Lawn & Amphitheatre",
        ["crowd", "road_events"],
        {
            "crowd_zone":      [[100, 200],  [900, 200],   [900, 900],   [100, 900]],
            "restricted_zone": [[600, 50],   [900, 50],    [900, 300],   [600, 300]],
            "road":            [[0, 900],    [1000, 900],  [1000, 1000], [0, 1000]],
            "crosswalk":       [[350, 880],  [650, 880],   [650, 1000],  [350, 1000]],
        },
    ),

    # ── 8. Highway / Expressway Toll Checkpoint ───────────────────────────────
    # Multi-lane expressway entry. Vehicle dwell in toll lanes.
    # No-parking on hard shoulder. Restricted zone at toll booth island.
    (
        "highway-toll-cam",
        "Expressway Toll Plaza — Entry Checkpoint",
        ["vehicle_parking", "road_events", "crowd"],
        {
            "road":            [[0, 150],    [1000, 150],  [1000, 850],  [0, 850]],
            "no_parking_zone": [[0, 150],    [100, 150],   [100, 850],   [0, 850]],
            "restricted_zone": [[420, 300],  [580, 300],   [580, 700],   [420, 700]],
            "crosswalk":       [[300, 820],  [700, 820],   [700, 950],   [300, 950]],
            "crowd_zone":      [[200, 850],  [800, 850],   [800, 1000],  [200, 1000]],
        },
    ),

    # ── 9. Government / Civic District ───────────────────────────────────────
    # Secure perimeter around municipal buildings. Restricted zone at entrance.
    # Road events for the access road. Crowd for public gathering area outside.
    (
        "civic-district-cam",
        "Government District — Municipal Complex",
        ["crowd", "road_events", "vehicle_parking"],
        {
            "restricted_zone": [[350, 0],    [650, 0],     [650, 350],   [350, 350]],
            "crowd_zone":      [[0, 550],    [1000, 550],  [1000, 1000], [0, 1000]],
            "road":            [[0, 300],    [1000, 300],  [1000, 600],  [0, 600]],
            "crosswalk":       [[300, 580],  [700, 580],   [700, 720],   [300, 720]],
            "no_parking_zone": [[850, 0],    [1000, 0],    [1000, 550],  [850, 550]],
        },
    ),

    # ── 10. Multi-Storey Parking Structure ───────────────────────────────────
    # All covered parking levels. Strict no-parking zones in fire lanes.
    # Restricted zone at stairwells/elevators. Crowd sensor at exits.
    (
        "parking-structure-cam",
        "Multi-Storey Parking Structure — Level 1",
        ["vehicle_parking", "crowd"],
        {
            "no_parking_zone": [[0, 0],      [1000, 0],    [1000, 200],  [0, 200]],
            "restricted_zone": [[800, 200],  [1000, 200],  [1000, 800],  [800, 800]],
            "crowd_zone":      [[0, 800],    [1000, 800],  [1000, 1000], [0, 1000]],
        },
    ),
]


def seed_cameras():
    db = SessionLocal()
    try:
        created = 0
        for camera_name, purpose, enabled_detections, zone_config in _CAMERAS:
            if db.query(Camera).filter(Camera.camera_name == camera_name).first():
                continue
            db.add(Camera(
                camera_name=camera_name,
                purpose=purpose,
                enabled_detections=json.dumps(enabled_detections),
                zone_config=json.dumps(zone_config),
            ))
            created += 1
        if created:
            db.commit()
            print(f"[seed_cameras] created {created} camera(s)")
    finally:
        db.close()


if __name__ == "__main__":
    seed_cameras()
