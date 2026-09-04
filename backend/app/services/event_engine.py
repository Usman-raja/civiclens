import time

_zone_state = {}  # person_id -> {"zone": str|None, "entered_at": float, "fired": set()}


def point_in_polygon(point, polygon):
    x, y = point
    n = len(polygon)
    inside = False
    j = n - 1
    for i in range(n):
        xi, yi = polygon[i]
        xj, yj = polygon[j]
        if (yi > y) != (yj > y):
            x_intersect = (xj - xi) * (y - yi) / (yj - yi + 1e-9) + xi
            if x < x_intersect:
                inside = not inside
        j = i
    return inside


def get_zone(point, zone_config: dict):
    for zone_name in ["crosswalk", "restricted_zone", "road"]:
        polygon = zone_config.get(zone_name)
        if polygon and point_in_polygon(point, polygon):
            return zone_name
    return None


def evaluate_zone_events(person_id: str, point, zone_config: dict, db=None):
    from app.services.settings_service import get_setting
    loiter_seconds = get_setting(db, "loiter_seconds") if db is not None else 10

    triggered = []
    current_zone = get_zone(point, zone_config)
    state = _zone_state.get(person_id, {"zone": None, "entered_at": None, "fired": set()})

    if current_zone != state["zone"]:
        state["zone"] = current_zone
        state["entered_at"] = time.time()
        state["fired"] = set()

        if current_zone == "crosswalk":
            triggered.append("pedestrian_crossing")
            state["fired"].add("pedestrian_crossing")
        elif current_zone == "road":
            triggered.append("jaywalking")
            state["fired"].add("jaywalking")
    else:
        if current_zone == "restricted_zone" and "loitering" not in state["fired"]:
            dwell = time.time() - state["entered_at"]
            if dwell >= loiter_seconds:
                triggered.append("loitering")
                state["fired"].add("loitering")

    _zone_state[person_id] = state
    return triggered


CROWD_ALERT_COOLDOWN_SECONDS = 30
CROWD_SURGE_COOLDOWN_SECONDS = 60
VEHICLE_IOU_MATCH_THRESHOLD = 0.3
VEHICLE_STALE_SECONDS = 10
# Unattended object: COCO class IDs for bag/backpack/handbag/suitcase
OBJECT_CLASS_IDS = {24, 26, 28}  # backpack, handbag, suitcase
OBJECT_STALE_SECONDS = 30
OBJECT_PERSON_PROXIMITY_PX = 100  # pixels; object is "attended" if a person centroid is within this distance

_last_crowd_alert = {}     # camera_name -> timestamp
_last_surge_alert = {}     # camera_name -> timestamp
_crowd_history = {}        # camera_name -> list of (timestamp, count)
_vehicle_tracks = {}       # camera_name -> list of track dicts
_vehicle_id_counter = {"n": 0}
_object_tracks = {}        # camera_name -> list of object track dicts


def count_in_zone(centroids, zone_polygon):
    if not zone_polygon:
        return 0
    return sum(1 for pt in centroids if point_in_polygon(pt, zone_polygon))


def crowd_alert_allowed(camera_name: str) -> bool:
    now = time.time()
    last = _last_crowd_alert.get(camera_name)
    if last is None or (now - last) >= CROWD_ALERT_COOLDOWN_SECONDS:
        _last_crowd_alert[camera_name] = now
        return True
    return False


def check_crowd_surge(camera_name: str, current_count: int, db=None):
    """Return surge info dict if a surge is detected, else None."""
    from app.services.settings_service import get_setting
    surge_threshold = get_setting(db, "crowd_surge_threshold") if db is not None else 5
    surge_window = get_setting(db, "crowd_surge_window_seconds") if db is not None else 30

    now = time.time()
    history = _crowd_history.get(camera_name, [])
    history.append((now, current_count))
    # Prune entries older than the window
    history = [(t, c) for t, c in history if now - t <= surge_window]
    _crowd_history[camera_name] = history

    if len(history) < 2:
        return None

    oldest_count = history[0][1]
    increase = current_count - oldest_count
    if increase < surge_threshold:
        return None

    # Enforce cooldown
    last = _last_surge_alert.get(camera_name)
    if last is not None and (now - last) < CROWD_SURGE_COOLDOWN_SECONDS:
        return None

    _last_surge_alert[camera_name] = now
    return {
        "increase": increase,
        "from_count": oldest_count,
        "to_count": current_count,
        "window_seconds": round(now - history[0][0], 1),
    }


def _iou(box_a, box_b):
    ax1, ay1, ax2, ay2 = box_a
    bx1, by1, bx2, by2 = box_b
    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    inter = max(0.0, ix2 - ix1) * max(0.0, iy2 - iy1)
    area_a = max(0.0, ax2 - ax1) * max(0.0, ay2 - ay1)
    area_b = max(0.0, bx2 - bx1) * max(0.0, by2 - by1)
    union = area_a + area_b - inter
    return inter / union if union > 0 else 0.0


def _next_vehicle_id():
    _vehicle_id_counter["n"] += 1
    return f"V{_vehicle_id_counter['n']:03d}"


def track_vehicles(camera_name: str, vehicle_boxes, zone_config: dict, db=None):
    from app.services.settings_service import get_setting
    vehicle_dwell_seconds = get_setting(db, "vehicle_dwell_seconds") if db is not None else 15

    now = time.time()
    tracks = _vehicle_tracks.get(camera_name, [])
    zone_polygon = zone_config.get("no_parking_zone")
    triggered = []

    for box in vehicle_boxes:
        best_track, best_iou = None, 0.0
        for track in tracks:
            score = _iou(box, track["bbox"])
            if score > best_iou:
                best_iou, best_track = score, track

        if best_track is not None and best_iou >= VEHICLE_IOU_MATCH_THRESHOLD:
            track = best_track
            track["bbox"] = box
            track["last_seen"] = now
        else:
            track = {
                "vehicle_id": _next_vehicle_id(),
                "bbox": box,
                "entered_zone_at": None,
                "fired": False,
                "last_seen": now,
            }
            tracks.append(track)

        cx, cy = (box[0] + box[2]) / 2, (box[1] + box[3]) / 2
        in_zone = bool(zone_polygon) and point_in_polygon((cx, cy), zone_polygon)

        if in_zone:
            if track["entered_zone_at"] is None:
                track["entered_zone_at"] = now
                track["fired"] = False
            elif not track["fired"] and (now - track["entered_zone_at"]) >= vehicle_dwell_seconds:
                track["fired"] = True
                triggered.append({
                    "vehicle_id": track["vehicle_id"],
                    "bbox": [round(v, 1) for v in box],
                    "dwell_seconds": round(now - track["entered_zone_at"], 1),
                })
        else:
            track["entered_zone_at"] = None
            track["fired"] = False

    _vehicle_tracks[camera_name] = [t for t in tracks if now - t["last_seen"] <= VEHICLE_STALE_SECONDS]
    return triggered


def _dist(ax, ay, bx, by):
    return ((ax - bx) ** 2 + (ay - by) ** 2) ** 0.5


# ---------------------------------------------------------------------------
# Road accident detection
#
# No crash-dataset model is needed: an accident is recognizable from geometry
# over time. Five signals, any sustained one is a probable accident:
#   1. fallen_person — a person's bbox becomes wider than tall (lying down)
#      while on the road/crosswalk. Catches pedestrians and riders who go down.
#   2. person_vehicle_overlap — a horizontal person mostly inside a
#      STATIONARY vehicle's box (under/against it). Riders on moving bikes are
#      excluded because their vehicle never settles.
#   3. vehicle_stopped_on_road — a vehicle stopped on the road with a person
#      standing clear of it (breakdown / post-crash scene).
#   4. vehicle_collision — two vehicle boxes physically overlapping.
#      Moving traffic never overlaps boxes, so contact = crash.
#   5. crashed_vehicle_pair — two vehicles stationary bumper-to-bumper on the
#      road for a while (post-crash scene where boxes don't overlap).
# ---------------------------------------------------------------------------

ACCIDENT_COOLDOWN_SECONDS = 60
FALLEN_ASPECT_RATIO = 0.85     # height/width below this = lying down
SLUMPED_ASPECT_RATIO = 1.2     # height/width below this = not clearly upright
PERSON_IOU_MATCH_THRESHOLD = 0.2
PERSON_STALE_SECONDS = 15
PERSON_MOVE_EPSILON_PX = 20    # person movement below this = stationary
VEHICLE_MOVE_EPSILON_PX = 15
ACCIDENT_VEHICLE_STALE_SECONDS = 25
VEHICLE_STATIONARY_SECONDS = 3  # vehicle must sit still this long before a
                                # person under it counts (kills moving riders)
VEHICLE_CONTAINMENT_MIN = 0.5   # fraction of person box inside vehicle box
VEHICLE_PAIR_OVERLAP_IOU = 0.10
VEHICLE_PAIR_GAP_PX = 60
PAIR_CLOSE_CONFIRM_SECONDS = 15
PERSON_VEHICLE_PROXIMITY_PX = 150

_last_accident_alert = {}          # camera_name -> timestamp
_person_tracks = {}                # camera_name -> list of person track dicts
_accident_vehicle_tracks = {}      # camera_name -> list of vehicle track dicts
_accident_vehicle_id_counter = {"n": 0}
_pair_close_state = {}             # (camera, vid_a, vid_b) -> first-close ts


def _containment(inner, outer):
    """Fraction of the inner box's area that lies inside the outer box."""
    ix1, iy1 = max(inner[0], outer[0]), max(inner[1], outer[1])
    ix2, iy2 = min(inner[2], outer[2]), min(inner[3], outer[3])
    inter = max(0.0, ix2 - ix1) * max(0.0, iy2 - iy1)
    area = max(0.0, inner[2] - inner[0]) * max(0.0, inner[3] - inner[1])
    return inter / area if area > 0 else 0.0


def _box_gap(a, b):
    """Pixel distance between two boxes (0 if they touch or overlap)."""
    dx = max(0.0, max(a[0], b[0]) - min(a[2], b[2]))
    dy = max(0.0, max(a[1], b[1]) - min(a[3], b[3]))
    return (dx * dx + dy * dy) ** 0.5


def _merge_box(a, b):
    return [min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3])]


def track_road_accidents(camera_name, person_boxes, vehicle_boxes, zone_config: dict, db=None):
    """Return a list of probable-accident hit dicts for this frame."""
    from app.services.settings_service import get_setting
    fallen_seconds = get_setting(db, "accident_fallen_seconds") if db is not None else 5
    vehicle_stop_seconds = get_setting(db, "accident_vehicle_stop_seconds") if db is not None else 10

    now = time.time()
    hits = []

    road_polygons = [zone_config.get(z) for z in ("road", "crosswalk")]
    road_polygons = [p for p in road_polygons if p]
    no_parking_polygon = zone_config.get("no_parking_zone")

    def on_road(cx, cy):
        return any(point_in_polygon((cx, cy), p) for p in road_polygons)

    # --- update person tracks: movement + fallen state --------------------
    p_tracks = _person_tracks.get(camera_name, [])
    persons = []  # per-frame person info for the signals below
    for box in person_boxes:
        cx, cy = (box[0] + box[2]) / 2, (box[1] + box[3]) / 2
        w, h = max(1.0, box[2] - box[0]), max(1.0, box[3] - box[1])

        best_track, best_iou = None, 0.0
        for track in p_tracks:
            score = _iou(box, track["bbox"])
            if score > best_iou:
                best_iou, best_track = score, track

        if best_track is not None and best_iou >= PERSON_IOU_MATCH_THRESHOLD:
            track = best_track
            if _dist(cx, cy, track["cx"], track["cy"]) > PERSON_MOVE_EPSILON_PX:
                track["last_moved"] = now
            track["bbox"] = box
            track["cx"], track["cy"] = cx, cy
            track["last_seen"] = now
        else:
            track = {"bbox": box, "cx": cx, "cy": cy, "fallen_since": None,
                     "last_moved": now, "last_seen": now}
            p_tracks.append(track)

        # --- signal 1: fallen person on the road --------------------------
        if h / w < FALLEN_ASPECT_RATIO and on_road(cx, cy):
            if track["fallen_since"] is None:
                track["fallen_since"] = now
            elif now - track["fallen_since"] >= fallen_seconds:
                hits.append({
                    "type": "fallen_person",
                    "bbox": [round(v, 1) for v in box],
                    "detail": f"Person lying on road for {round(now - track['fallen_since'], 1)}s",
                })
                track["fallen_since"] = now  # avoid re-firing every frame
        else:
            track["fallen_since"] = None

        persons.append({
            "box": box, "cx": cx, "cy": cy,
            "horizontal": h / w < SLUMPED_ASPECT_RATIO,
            "stationary_for": now - track["last_moved"],
        })

    _person_tracks[camera_name] = [t for t in p_tracks if now - t["last_seen"] <= PERSON_STALE_SECONDS]

    # --- update vehicle tracks: movement state ----------------------------
    v_tracks = _accident_vehicle_tracks.get(camera_name, [])
    vehicles = []
    for box in vehicle_boxes:
        cx, cy = (box[0] + box[2]) / 2, (box[1] + box[3]) / 2

        best_track, best_iou = None, 0.0
        for track in v_tracks:
            score = _iou(box, track["bbox"])
            if score > best_iou:
                best_iou, best_track = score, track

        if best_track is not None and best_iou >= VEHICLE_IOU_MATCH_THRESHOLD:
            track = best_track
            if _dist(cx, cy, track["cx"], track["cy"]) > VEHICLE_MOVE_EPSILON_PX:
                track["last_moved"] = now
            track["bbox"] = box
            track["cx"], track["cy"] = cx, cy
            track["last_seen"] = now
        else:
            _accident_vehicle_id_counter["n"] += 1
            track = {"vehicle_id": f"AV{_accident_vehicle_id_counter['n']:03d}",
                     "bbox": box, "cx": cx, "cy": cy,
                     "last_moved": now, "last_seen": now}
            v_tracks.append(track)

        vehicles.append({
            "vid": track["vehicle_id"], "box": box, "cx": cx, "cy": cy,
            "stationary_for": now - track["last_moved"],
        })

    _accident_vehicle_tracks[camera_name] = [t for t in v_tracks
                                             if now - t["last_seen"] <= ACCIDENT_VEHICLE_STALE_SECONDS]

    # --- signal 2: horizontal person inside a stationary vehicle ----------
    # An upright rider/driver sits tall in the vehicle box; a victim under or
    # slumped against a stopped vehicle reads as horizontal. The vehicle must
    # also be stationary — a rider on a moving bike overlaps its box forever.
    for p in persons:
        if not p["horizontal"]:
            continue
        for v in vehicles:
            if v["stationary_for"] < VEHICLE_STATIONARY_SECONDS:
                continue
            if _containment(p["box"], v["box"]) < VEHICLE_CONTAINMENT_MIN:
                continue
            hits.append({
                "type": "person_vehicle_overlap",
                "bbox": [round(x, 1) for x in p["box"]],
                "detail": f"Person down against/under a vehicle for {round(v['stationary_for'], 1)}s",
            })
            break

    # --- signal 3: stopped vehicle on the road with a person alongside ----
    # The person must be clear of the vehicle (not the rider) and standing
    # still — pedestrians walking past stopped traffic don't count.
    for v in vehicles:
        if v["stationary_for"] < vehicle_stop_seconds or not on_road(v["cx"], v["cy"]):
            continue
        if no_parking_polygon and point_in_polygon((v["cx"], v["cy"]), no_parking_polygon):
            continue  # illegal-parking tracker already owns this vehicle
        for p in persons:
            if _iou(p["box"], v["box"]) > 0.05:
                continue  # on/inside the vehicle — rider or driver
            if _dist(p["cx"], p["cy"], v["cx"], v["cy"]) > PERSON_VEHICLE_PROXIMITY_PX:
                continue
            if p["stationary_for"] < vehicle_stop_seconds:
                continue  # moving pedestrian, not someone tending a crash
            hits.append({
                "type": "vehicle_stopped_on_road",
                "bbox": [round(x, 1) for x in v["box"]],
                "detail": f"Vehicle stopped on road {round(v['stationary_for'], 1)}s with person alongside",
            })
            break

    # --- signals 4 & 5: vehicle-vs-vehicle collisions ----------------------
    pair_seen = set()
    for i in range(len(vehicles)):
        for j in range(i + 1, len(vehicles)):
            a, b = vehicles[i], vehicles[j]
            pair_key = (camera_name, a["vid"], b["vid"])
            pair_seen.add(pair_key)

            both_still = (a["stationary_for"] >= VEHICLE_STATIONARY_SECONDS and
                          b["stationary_for"] >= VEHICLE_STATIONARY_SECONDS)
            if not both_still:
                _pair_close_state.pop(pair_key, None)
                continue

            # 4. boxes physically overlapping once both vehicles have settled —
            #    moving traffic (even lane-splitting bikes) never sustains this
            if _iou(a["box"], b["box"]) >= VEHICLE_PAIR_OVERLAP_IOU:
                hits.append({
                    "type": "vehicle_collision",
                    "bbox": [round(x, 1) for x in _merge_box(a["box"], b["box"])],
                    "detail": f"Two vehicles in contact at ({round(a['cx'])}, {round(a['cy'])})",
                })

            # 5. two vehicles parked bumper-to-bumper on the road after a crash
            elif (on_road(a["cx"], a["cy"]) and on_road(b["cx"], b["cy"])
                    and _box_gap(a["box"], b["box"]) <= VEHICLE_PAIR_GAP_PX):
                if pair_key not in _pair_close_state:
                    _pair_close_state[pair_key] = now
                elif now - _pair_close_state[pair_key] >= PAIR_CLOSE_CONFIRM_SECONDS:
                    hits.append({
                        "type": "crashed_vehicle_pair",
                        "bbox": [round(x, 1) for x in _merge_box(a["box"], b["box"])],
                        "detail": f"Two vehicles stopped together on road for {round(now - _pair_close_state[pair_key], 1)}s",
                    })
            else:
                _pair_close_state.pop(pair_key, None)

    # Prune pair state for vehicles no longer in frame
    for key in list(_pair_close_state.keys()):
        if key[0] == camera_name and key not in pair_seen:
            del _pair_close_state[key]

    if not hits:
        return []

    # Cooldown so one accident produces one alert, not a stream of them.
    last = _last_accident_alert.get(camera_name)
    if last is not None and (now - last) < ACCIDENT_COOLDOWN_SECONDS:
        return []
    _last_accident_alert[camera_name] = now
    return hits


def track_unattended_objects(camera_name: str, object_boxes, person_centroids, db=None):
    """
    Track bag/backpack/handbag/suitcase detections. Returns list of triggered alerts
    for objects that have been unattended (no nearby person) for the configured dwell time.
    object_boxes: list of [x1,y1,x2,y2] for detected objects of interest.
    person_centroids: list of [cx,cy] for all detected persons in the frame.
    """
    from app.services.settings_service import get_setting
    dwell_seconds = get_setting(db, "unattended_object_seconds") if db is not None else 20

    now = time.time()
    tracks = _object_tracks.get(camera_name, [])
    triggered = []

    for box in object_boxes:
        cx, cy = (box[0] + box[2]) / 2, (box[1] + box[3]) / 2
        attended = any(
            _dist(cx, cy, px, py) <= OBJECT_PERSON_PROXIMITY_PX
            for px, py in person_centroids
        )

        best_track, best_iou_val = None, 0.0
        for track in tracks:
            score = _iou(box, track["bbox"])
            if score > best_iou_val:
                best_iou_val, best_track = score, track

        if best_track is not None and best_iou_val >= 0.2:
            track = best_track
            track["bbox"] = box
            track["last_seen"] = now
        else:
            track = {
                "object_id": f"OBJ{len(tracks) + 1:03d}",
                "bbox": box,
                "unattended_since": None,
                "fired": False,
                "last_seen": now,
            }
            tracks.append(track)

        if attended:
            track["unattended_since"] = None
            track["fired"] = False
        else:
            if track["unattended_since"] is None:
                track["unattended_since"] = now
            elif not track["fired"] and (now - track["unattended_since"]) >= dwell_seconds:
                track["fired"] = True
                triggered.append({
                    "object_id": track["object_id"],
                    "bbox": [round(v, 1) for v in box],
                    "dwell_seconds": round(now - track["unattended_since"], 1),
                })

    _object_tracks[camera_name] = [t for t in tracks if now - t["last_seen"] <= OBJECT_STALE_SECONDS]
    return triggered
