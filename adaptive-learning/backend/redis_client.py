"""Shared Redis connection for this service's temporary state (target
production architecture: Redis = cache / temporary state / queues — never
the persistent source of truth; see db/migrations/ at the repo root for
what belongs in PostgreSQL instead).
"""

import os
import redis

REDIS_URL = os.environ.get("REDIS_URL", "redis://127.0.0.1:6379/0")

redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True)
