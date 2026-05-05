# Emotion Analytics Backend

FastAPI service for real-time student emotion processing and adaptive game recommendations.

## APIs

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/emotions` | POST | Ingest student emotion events |
| `/analytics/current` | GET | Current emotion distribution |
| `/analytics/trend` | GET | Emotion trends over time |
| `/recommendation/latest` | GET | Game recommendation based on dominant emotion |

## Run Locally

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Docs: http://localhost:8000/docs
