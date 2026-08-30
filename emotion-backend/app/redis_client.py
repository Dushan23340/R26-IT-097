"""Shared Redis connection for this service's temporary/real-time state
(target production architecture: Redis = cache / temp state / active
sessions — never the persistent source of truth, see repo root
db/migrations/ for what belongs in PostgreSQL instead).

Every store module in app/services/ follows the same pattern: load the
full state from one Redis key at the start of a method, run the exact
same business logic this service already had, save it back at the end.
Redis is a swapped storage backend here, not a rewrite of behavior.
"""

import os
import redis

REDIS_URL = os.getenv("REDIS_URL", "redis://127.0.0.1:6379/0")

redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True)
