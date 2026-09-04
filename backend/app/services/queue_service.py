"""
Message queue service — Redis pub/sub for distributed detection processing.

When MESSAGE_QUEUE is set in .env (e.g. redis://localhost:6379), detection
events are published to Redis for async processing by worker nodes.
When not set, events are processed inline (zero-setup default).

Config (.env):
    MESSAGE_QUEUE=redis://localhost:6379    # Enable Redis queue
    MESSAGE_QUEUE=                           # Disabled — inline processing
    QUEUE_CHANNEL=civiclens:detections      # Redis channel name (optional)
"""

import json
import logging
import os
import threading

logger = logging.getLogger(__name__)

QUEUE_URL = os.getenv("MESSAGE_QUEUE", "").strip()
CHANNEL = os.getenv("QUEUE_CHANNEL", "civiclens:detections")

_redis = None


def _get_redis():
    global _redis
    if _redis is not None:
        return _redis
    if not QUEUE_URL:
        return None
    try:
        import redis as redis_lib
        _redis = redis_lib.from_url(QUEUE_URL, decode_responses=True)
        _redis.ping()
        logger.info("Message queue connected: %s", QUEUE_URL)
        return _redis
    except Exception as e:
        logger.warning("Message queue unavailable (%s), falling back to inline", e)
        return None


def is_enabled() -> bool:
    return _get_redis() is not None


def publish(event_type: str, payload: dict) -> bool:
    """Publish a detection event to the queue.

    Returns True if published, False if queue disabled (caller should process inline).
    """
    r = _get_redis()
    if r is None:
        return False
    message = json.dumps({"event_type": event_type, "payload": payload}, default=str)
    try:
        r.publish(CHANNEL, message)
        return True
    except Exception as e:
        logger.warning("Queue publish failed: %s", e)
        return False


def publish_detection(frame_data: dict) -> bool:
    """Publish a full detection result for async processing."""
    return publish("detection", frame_data)


def publish_alert(alert_type: str, alert_data: dict) -> bool:
    """Publish an alert (redlist, missing person, scene) for async processing."""
    return publish(f"alert:{alert_type}", alert_data)


def start_consumer(handler_fn, channel: str | None = None):
    """Start a background consumer thread that calls handler_fn(event_type, payload)
    for every message received on the queue channel.

    handler_fn signature: def handler(event_type: str, payload: dict) -> None
    """
    r = _get_redis()
    if r is None:
        logger.info("Queue consumer: skipped (no queue configured)")
        return

    ch = channel or CHANNEL
    pubsub = r.pubsub()
    pubsub.subscribe(ch)
    logger.info("Queue consumer listening on channel: %s", ch)

    def _listen():
        for message in pubsub.listen():
            if message["type"] != "message":
                continue
            try:
                data = json.loads(message["data"])
                handler_fn(data.get("event_type", ""), data.get("payload", {}))
            except Exception as e:
                logger.error("Queue consumer error: %s", e)

    threading.Thread(target=_listen, daemon=True, name="queue-consumer").start()
